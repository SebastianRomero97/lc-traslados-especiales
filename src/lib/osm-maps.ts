export type MapaParada = {
  clientId: string;
  label: string;
  direccion: string;
  /** Si ya hay coordenadas, se usan sin geocodificar. */
  lat?: number | null;
  lon?: number | null;
};

export type Coords = { lat: number; lon: number };

export type ParadaGeocodificada = MapaParada & { coords: Coords };

type LineGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

const geocodeCache = new Map<string, Coords | null>();

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/** Servidor demo público de OSRM — uso liviano; no para tráfico alto de producción. */
const OSRM_URL = 'https://router.project-osrm.org';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidCoords(coords: { lat?: number | null; lon?: number | null } | null | undefined): coords is Coords {
  return (
    coords != null &&
    typeof coords.lat === 'number' &&
    typeof coords.lon === 'number' &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lon) &&
    Math.abs(coords.lat) <= 90 &&
    Math.abs(coords.lon) <= 180
  );
}

export function coordsFromParada(p: {
  lat?: number | null;
  lon?: number | null;
}): Coords | null {
  const lat = p.lat;
  const lon = p.lon;
  if (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  ) {
    return { lat, lon };
  }
  return null;
}

/** Geocodifica una dirección (Argentina) vía Nominatim. Respeta ~1 req/s. */
export async function geocodeDireccion(direccion: string): Promise<Coords | null> {
  const key = direccion.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  const params = new URLSearchParams({
    q: `${direccion}, Argentina`,
    format: 'json',
    limit: '1',
    countrycodes: 'ar',
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'LC-Traslados-Especiales/1.0 (panel-administracion)',
    },
  });

  if (!response.ok) {
    geocodeCache.set(key, null);
    return null;
  }

  const data = (await response.json()) as { lat: string; lon: string }[];
  const first = data[0];
  if (!first) {
    geocodeCache.set(key, null);
    return null;
  }

  const coords = { lat: Number(first.lat), lon: Number(first.lon) };
  geocodeCache.set(key, coords);
  return coords;
}

export type GeocodeParadasResult = {
  ubicadas: ParadaGeocodificada[];
  /** Paradas con dirección pero sin coords (geocode falló). */
  faltantes: MapaParada[];
  /** clientIds cuya ubicación salió del geocoder (no traían lat/lon). */
  recienGeocodificadas: ParadaGeocodificada[];
};

/** Resuelve paradas: usa coords existentes o geocodifica. */
export async function geocodeParadas(
  paradas: MapaParada[],
  onProgress?: (done: number, total: number) => void,
): Promise<GeocodeParadasResult> {
  const ubicadas: ParadaGeocodificada[] = [];
  const faltantes: MapaParada[] = [];
  const recienGeocodificadas: ParadaGeocodificada[] = [];
  const conDireccion = paradas.filter((p) => p.direccion.trim());
  const total = conDireccion.length;
  let done = 0;
  let needsDelay = false;

  for (const p of conDireccion) {
    const existing = coordsFromParada(p);
    if (existing) {
      ubicadas.push({ ...p, coords: existing });
      done += 1;
      onProgress?.(done, total);
      continue;
    }

    if (needsDelay) await sleep(1100);
    needsDelay = true;
    const coords = await geocodeDireccion(p.direccion);
    done += 1;
    onProgress?.(done, total);
    if (coords) {
      const geo = { ...p, coords };
      ubicadas.push(geo);
      recienGeocodificadas.push(geo);
    } else {
      faltantes.push(p);
    }
  }

  return { ubicadas, faltantes, recienGeocodificadas };
}

export type OsrmLeg = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: LineGeometry;
  fromIndex: number;
  toIndex: number;
};

export type OsrmRouteResult = {
  geometry: LineGeometry;
  distanceMeters: number;
  durationSeconds: number;
  legs: OsrmLeg[];
};

type OsrmStepJson = {
  geometry?: LineGeometry;
};

type OsrmLegJson = {
  distance: number;
  duration: number;
  steps?: OsrmStepJson[];
};

function mergeStepGeometries(steps: OsrmStepJson[] | undefined): LineGeometry | null {
  if (!steps?.length) return null;
  const coordinates: [number, number][] = [];
  for (const step of steps) {
    const coords = step.geometry?.coordinates;
    if (!coords?.length) continue;
    for (const c of coords) {
      const prev = coordinates[coordinates.length - 1];
      if (prev && prev[0] === c[0] && prev[1] === c[1]) continue;
      coordinates.push(c);
    }
  }
  if (coordinates.length < 2) return null;
  return { type: 'LineString', coordinates };
}

function straightLegGeometry(from: Coords, to: Coords): LineGeometry {
  return {
    type: 'LineString',
    coordinates: [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ],
  };
}

function parseOsrmLegs(
  legsJson: OsrmLegJson[] | undefined,
  waypoints: Coords[],
): OsrmLeg[] {
  if (!legsJson?.length || waypoints.length < 2) return [];
  const legs: OsrmLeg[] = [];
  for (let i = 0; i < legsJson.length; i++) {
    const leg = legsJson[i];
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (!from || !to) continue;
    legs.push({
      distanceMeters: leg.distance,
      durationSeconds: leg.duration,
      geometry: mergeStepGeometries(leg.steps) ?? straightLegGeometry(from, to),
      fromIndex: i,
      toIndex: i + 1,
    });
  }
  return legs;
}

/** Ruta en el orden dado (driving), con tramos entre waypoints. */
export async function osrmRoute(coords: Coords[]): Promise<OsrmRouteResult | null> {
  if (coords.length < 2) return null;
  const path = coords.map((c) => `${c.lon},${c.lat}`).join(';');
  const url = `${OSRM_URL}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    code?: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: LineGeometry;
      legs?: OsrmLegJson[];
    }[];
  };
  if (data.code !== 'Ok' || !data.routes?.[0]) return null;
  const route = data.routes[0];
  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    legs: parseOsrmLegs(route.legs, coords),
  };
}

export type OsrmTripResult = OsrmRouteResult & {
  waypointOrder: number[];
};

/**
 * Optimiza el orden de paradas intermedias (OSRM Trip).
 * Mantiene primera y última (source=first, destination=last).
 * Luego recalcula la ruta ordenada para obtener tramos (legs).
 */
export async function osrmTripOptimize(coords: Coords[]): Promise<OsrmTripResult | null> {
  if (coords.length < 3) return null;
  const path = coords.map((c) => `${c.lon},${c.lat}`).join(';');
  const url = `${OSRM_URL}/trip/v1/driving/${path}?overview=false&source=first&destination=last&roundtrip=false`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    code?: string;
    trips?: {
      distance: number;
      duration: number;
    }[];
    waypoints?: { waypoint_index: number }[];
  };
  if (data.code !== 'Ok' || !data.trips?.[0] || !data.waypoints) return null;

  const ordered = [...data.waypoints]
    .map((wp, inputIndex) => ({ inputIndex, order: wp.waypoint_index }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.inputIndex);

  const orderedCoords = ordered.map((idx) => coords[idx]).filter(Boolean) as Coords[];
  const routed = await osrmRoute(orderedCoords);
  if (!routed) {
    const trip = data.trips[0];
    return {
      geometry: {
        type: 'LineString',
        coordinates: orderedCoords.map((c) => [c.lon, c.lat]),
      },
      distanceMeters: trip.distance,
      durationSeconds: trip.duration,
      legs: [],
      waypointOrder: ordered,
    };
  }

  return {
    ...routed,
    waypointOrder: ordered,
  };
}

export function formatDistanciaDuracion(meters: number, seconds: number): string {
  const km = (meters / 1000).toFixed(1);
  const mins = Math.max(1, Math.round(seconds / 60));
  return `Recorrido ≈ ${km} km · ${mins} min`;
}

/** Etiqueta corta para un tramo (hover en mapa). */
export function formatTramoKmMin(meters: number, seconds: number): string {
  const km = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${km} · ${mins} min`;
}

/**
 * Duraciones (minutos) entre paradas consecutivas vía OSRM.
 * `gaps[i]` = minutos de viaje de la parada i → i+1.
 * Si falta coords o falla OSRM, esa posición queda `null` (usar fallback).
 */
export async function osrmTravelGapsMinutes(
  coordsPerStop: (Coords | null)[],
): Promise<(number | null)[]> {
  const n = coordsPerStop.length;
  if (n < 2) return [];

  const gaps: (number | null)[] = Array.from({ length: n - 1 }, () => null);

  // Segmentos contiguos con coords válidas → una sola request OSRM por bloque.
  let start = -1;
  const flush = async (from: number, to: number) => {
    const slice = coordsPerStop.slice(from, to + 1) as Coords[];
    if (slice.length < 2) return;
    const route = await osrmRoute(slice);
    if (!route?.legs.length) return;
    for (let i = 0; i < route.legs.length; i++) {
      const leg = route.legs[i];
      gaps[from + i] = Math.max(1, Math.round(leg.durationSeconds / 60));
    }
  };

  for (let i = 0; i < n; i++) {
    if (coordsPerStop[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      await flush(start, i - 1);
      start = -1;
    }
  }
  if (start >= 0) await flush(start, n - 1);

  return gaps;
}
