'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  geocodeParadas,
  osrmRoute,
  osrmTripOptimize,
  type Coords,
  type MapaParada,
  type ParadaGeocodificada,
} from '@/lib/osm-maps';

function makeNumberIcon(n: number, adjusted?: boolean) {
  return L.divIcon({
    className: 'grilla-mapa-marker',
    html: `<span class="grilla-mapa-marker__badge${adjusted ? ' grilla-mapa-marker__badge--ajustado' : ''}">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

type Props = {
  paradas: MapaParada[];
  optimizarToken?: number;
  onOrdenOptimizado?: (ordenClientIds: string[]) => void;
  /** Coordenadas encontradas automáticamente (sin intervención). */
  onCoordsGeocoded?: (clientId: string, coords: Coords) => void;
  /** Usuario movió o colocó el pin. */
  onPinAdjusted?: (clientId: string, coords: Coords) => void;
  onError?: (message: string) => void;
};

export function GrillaMapa({
  paradas,
  optimizarToken = 0,
  onOrdenOptimizado,
  onCoordsGeocoded,
  onPinAdjusted,
  onError,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const lastOptToken = useRef(0);
  const placeClientIdRef = useRef<string | null>(null);
  const onOrdenRef = useRef(onOrdenOptimizado);
  const onGeocodedRef = useRef(onCoordsGeocoded);
  const onPinRef = useRef(onPinAdjusted);
  const onErrorRef = useRef(onError);
  onOrdenRef.current = onOrdenOptimizado;
  onGeocodedRef.current = onCoordsGeocoded;
  onPinRef.current = onPinAdjusted;
  onErrorRef.current = onError;

  const [mapReady, setMapReady] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resumen, setResumen] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<MapaParada[]>([]);
  const [placeClientId, setPlaceClientId] = useState<string | null>(null);
  placeClientIdRef.current = placeClientId;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [-34.543, -58.712],
      zoom: 12,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    layerGroup.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    setMapReady(true);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const id = placeClientIdRef.current;
      if (!id) return;
      onPinRef.current?.(id, { lat: e.latlng.lat, lon: e.latlng.lng });
      setPlaceClientId(null);
    });

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapInstance.current = null;
      layerGroup.current = null;
    };
  }, []);

  useEffect(() => {
    const el = mapInstance.current?.getContainer();
    if (!el) return;
    el.style.cursor = placeClientId ? 'crosshair' : '';
  }, [placeClientId]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !layerGroup.current) return;

    const validas = paradas.filter((p) => p.direccion.trim());
    if (validas.length === 0) {
      layerGroup.current.clearLayers();
      setResumen(null);
      setBusyMsg('');
      setErrorMsg('');
      setFaltantes([]);
      return;
    }

    const shouldOptimize =
      optimizarToken > 0 &&
      optimizarToken !== lastOptToken.current &&
      validas.length > 2;

    const needsGeocode = validas.some((p) => p.lat == null || p.lon == null);
    let cancelled = false;
    setBusyMsg(needsGeocode ? 'Geocodificando direcciones…' : 'Actualizando mapa…');
    setErrorMsg('');

    void (async () => {
      try {
        const { ubicadas, faltantes: missing, recienGeocodificadas } = await geocodeParadas(
          validas,
          (done, total) => {
            if (!cancelled && needsGeocode) setBusyMsg(`Geocodificando ${done}/${total}…`);
          },
        );
        if (cancelled) return;

        for (const g of recienGeocodificadas) {
          onGeocodedRef.current?.(g.clientId, g.coords);
        }

        setFaltantes(missing);

        if (ubicadas.length === 0) {
          setBusyMsg('');
          setErrorMsg(
            missing.length > 0
              ? 'No se pudieron ubicar las direcciones. Usá “Ubicar en mapa” y hacé clic donde corresponde.'
              : 'No se pudieron ubicar las direcciones en el mapa.',
          );
          setResumen(null);
          layerGroup.current?.clearLayers();
          return;
        }

        layerGroup.current?.clearLayers();

        let routeCoords = ubicadas;
        let distance = 0;
        let duration = 0;
        let labelPrefix = 'Recorrido';
        let drewRoute = false;

        if (shouldOptimize && ubicadas.length >= 3) {
          setBusyMsg('Optimizando recorrido…');
          const trip = await osrmTripOptimize(ubicadas.map((g) => g.coords));
          if (cancelled) return;
          if (trip) {
            lastOptToken.current = optimizarToken;
            const ordered = trip.waypointOrder
              .map((idx) => ubicadas[idx])
              .filter(Boolean) as ParadaGeocodificada[];
            if (ordered.length === ubicadas.length) {
              routeCoords = ordered;
              onOrdenRef.current?.(ordered.map((o) => o.clientId));
            }
            distance = trip.distanceMeters;
            duration = trip.durationSeconds;
            labelPrefix = 'Optimizado';
            L.geoJSON(trip.geometry as GeoJSON.GeoJsonObject, {
              style: { color: '#002D72', weight: 5, opacity: 0.85 },
            }).addTo(layerGroup.current!);
            drewRoute = true;
          } else {
            onErrorRef.current?.('No se pudo optimizar la ruta. Se muestra el orden actual.');
          }
        }

        const latLngs = routeCoords.map((g) => L.latLng(g.coords.lat, g.coords.lon));
        routeCoords.forEach((g, i) => {
          const hadStored = g.lat != null && g.lon != null;
          const marker = L.marker(latLngs[i], {
            icon: makeNumberIcon(i + 1, hadStored),
            draggable: true,
            title: 'Arrastrá para ajustar la ubicación',
          })
            .bindPopup(
              `<strong>${escapeHtml(g.label)}</strong><br/>${escapeHtml(g.direccion)}<br/><em>Arrastrá el pin para ajustar</em>`,
            )
            .addTo(layerGroup.current!);

          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onPinRef.current?.(g.clientId, { lat: pos.lat, lon: pos.lng });
          });
        });

        if (!drewRoute && routeCoords.length >= 2) {
          setBusyMsg('Calculando ruta…');
          const route = await osrmRoute(routeCoords.map((g) => g.coords));
          if (cancelled) return;
          if (route) {
            distance = route.distanceMeters;
            duration = route.durationSeconds;
            L.geoJSON(route.geometry as GeoJSON.GeoJsonObject, {
              style: { color: '#002D72', weight: 5, opacity: 0.85 },
            }).addTo(layerGroup.current!);
          } else {
            L.polyline(latLngs, { color: '#002D72', weight: 3, dashArray: '6 8' }).addTo(
              layerGroup.current!,
            );
          }
        }

        if (cancelled) return;
        mapInstance.current?.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36] });

        if (routeCoords.length === 1) {
          setResumen(routeCoords[0].label);
        } else if (distance > 0) {
          setResumen(
            `${labelPrefix} ≈ ${(distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(duration / 60))} min`,
          );
        } else {
          setResumen('Marcadores ubicados');
        }

        setBusyMsg(
          missing.length > 0
            ? `Se ubicaron ${ubicadas.length} de ${validas.length} paradas. Arrastrá los pines para ajustar.`
            : 'Arrastrá un pin para ajustar la ubicación.',
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'No se pudo armar el mapa del recorrido.';
        setErrorMsg(message);
        setBusyMsg('');
        setResumen(null);
        onErrorRef.current?.(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paradas, optimizarToken, mapReady]);

  return (
    <div className="grilla-mapa">
      <div className="grilla-mapa__head">
        <h3>Mapa del recorrido</h3>
        {resumen && <p className="grilla-mapa__resumen">{resumen}</p>}
      </div>
      <p className="grilla-mapa__provider">
        OpenStreetMap + OSRM — la dirección de texto no se modifica; el pin guarda la ubicación del
        mapa.
      </p>
      {errorMsg && <p className="grilla-mapa__msg grilla-mapa__msg--error">{errorMsg}</p>}
      {busyMsg && !errorMsg && <p className="grilla-mapa__msg">{busyMsg}</p>}
      {placeClientId && (
        <p className="grilla-mapa__msg grilla-mapa__msg--place">
          Hacé clic en el mapa para ubicar la parada.{' '}
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setPlaceClientId(null)}>
            Cancelar
          </button>
        </p>
      )}
      {faltantes.length > 0 && (
        <ul className="grilla-mapa__faltantes">
          {faltantes.map((p) => (
            <li key={p.clientId}>
              <span>
                Sin ubicar: <strong>{p.label}</strong> — {p.direccion}
              </span>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setPlaceClientId(p.clientId)}
              >
                Ubicar en mapa
              </button>
            </li>
          ))}
        </ul>
      )}
      {paradas.filter((p) => p.direccion.trim()).length === 0 && mapReady && !busyMsg && (
        <p className="grilla-mapa__msg">Agregá paradas con dirección para ver la ruta.</p>
      )}
      <div ref={mapRef} className="grilla-mapa__canvas" aria-label="Mapa del itinerario" />
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type { MapaParada };
