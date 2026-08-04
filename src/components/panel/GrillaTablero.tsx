'use client';

import { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import {
  accionPorTipoParada,
  buildDetalleDestino,
  buildTipoItinerario,
  isSalidaItinerario,
  mapGrillaFilaToForm,
  splitTipoItinerario,
  sugerirHorariosHaciaAtras,
  todayFechaInput,
  type AccionParada,
  type ModalidadItinerario,
  type SentidoItinerario,
  type TipoItinerario,
  type TipoParadaForm,
} from '@/lib/grilla.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import type { MapaParada } from '@/lib/osm-maps';

const GrillaMapa = dynamic(
  () => import('@/components/panel/GrillaMapa').then((m) => m.GrillaMapa),
  {
    ssr: false,
    loading: () => (
      <p className="panel-card__desc" style={{ margin: '0.75rem 0' }}>
        Cargando mapa…
      </p>
    ),
  },
);

type RecursoTipo = 'vehiculos' | 'choferes' | 'celadoras' | 'pasajeros' | 'destinos';

type DragPayload =
  | { kind: 'vehiculo'; id: string }
  | { kind: 'chofer'; id: string }
  | { kind: 'celadora'; id: string }
  | { kind: 'pasajero'; id: string }
  | { kind: 'destino'; id: string }
  | { kind: 'fila'; clientId: string };

type FilaBoard = {
  clientId: string;
  tipoParada: TipoParadaForm;
  hora: string;
  direccion: string;
  pasajeroNombre: string;
  /** Si la administración editó el detalle a mano, no se recalcula solo. */
  detalleManual: boolean;
  pasajeroId: string;
  destinoId: string;
  accion: AccionParada;
  trasbordoHacia: string;
  lat: number | null;
  lon: number | null;
  usarCoordsParaChofer: boolean;
};

export type GrillaTableroOptions = {
  transportes: {
    id: string;
    nombre: string;
    tipo: string;
    choferes: { id: string; username: string }[];
    celadoras: { id: string; username: string }[];
  }[];
  celadoras: { id: string; username: string }[];
  pasajeros: {
    id: string;
    nombre: string;
    direccion: string;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
    destinoIds?: string[];
    destinoId?: string | null;
  }[];
  destinos: {
    id: string;
    nombre: string;
    domicilio: string;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
  }[];
  choferes: { id: string; username: string; transporteId: string | null }[];
};

export type GrillaTableroInitial = {
  id: string;
  nombre: string;
  tipoItinerario: TipoItinerario;
  fecha: string;
  nota: string | null;
  estado?: string;
  notaRevision?: string | null;
  /** ISO timestamp para locking optimista al guardar. */
  updatedAt?: string;
  conCeladora: boolean;
  salidaDeBase?: boolean;
  retornoABase?: boolean;
  transporte: { id: string; nombre: string; tipo: string };
  chofer: { id: string; username: string };
  celadora: { id: string; username: string } | null;
  puntoEncuentro?: {
    id: string;
    nombre: string | null;
    direccion: string;
    frecuente: boolean;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
  } | null;
  filas: {
    id: string;
    hora: string | null;
    direccion: string;
    pasajeroNombre: string;
    pasajeroId?: string | null;
    destinoId?: string | null;
    accion: AccionParada | string;
    trasbordoHacia: string | null;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean | null;
  }[];
};

const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `fila-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DRAG_MIME = 'application/x-lc-recurso';

function setDragPayload(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'move';
}

function readDragPayload(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function fechaToInput(fecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.slice(0, 10);
  try {
    return new Date(fecha).toISOString().slice(0, 10);
  } catch {
    return todayFechaInput();
  }
}

type Props = {
  areaId: string;
  options: GrillaTableroOptions;
  initial: GrillaTableroInitial | null;
  /** Fecha sugerida al crear (YYYY-MM-DD). */
  defaultFecha?: string;
  /** Tipo de itinerario sugerido al crear. */
  defaultTipoItinerario?: TipoItinerario;
  /** Admin: al guardar PATCH, aprueba la grilla (lista para empezar). */
  aprobarDespues?: boolean;
  /** Solo Admin puede eliminar grillas. */
  allowDelete?: boolean;
  onSaved: () => void;
  onDeleted?: () => void;
  onCancel: () => void;
};

export function GrillaTablero({
  areaId,
  options,
  initial,
  defaultFecha,
  defaultTipoItinerario,
  aprobarDespues = false,
  allowDelete = false,
  onSaved,
  onDeleted,
  onCancel,
}: Props) {
  const popup = usePanelPopup();
  const isNew = !initial?.id;

  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const initialSplit = splitTipoItinerario(
    initial?.tipoItinerario ?? defaultTipoItinerario ?? 'INGRESO',
  );
  const [modalidad, setModalidad] = useState<ModalidadItinerario>(initialSplit.modalidad);
  const [sentido, setSentido] = useState<SentidoItinerario | ''>(() => {
    if (initialSplit.modalidad === 'ESPECIAL') return initialSplit.sentido;
    return initialSplit.sentido || 'INGRESO';
  });
  const tipoItinerario = buildTipoItinerario(modalidad, sentido);
  const [fecha, setFecha] = useState(
    initial
      ? fechaToInput(initial.fecha)
      : defaultFecha && /^\d{4}-\d{2}-\d{2}/.test(defaultFecha)
        ? defaultFecha.slice(0, 10)
        : todayFechaInput(),
  );
  const [nota, setNota] = useState(initial?.nota ?? '');
  const [salidaDeBase, setSalidaDeBase] = useState(Boolean(initial?.salidaDeBase));
  const [retornoABase, setRetornoABase] = useState(Boolean(initial?.retornoABase));
  const [transporteId, setTransporteId] = useState(initial?.transporte.id ?? '');
  const [choferId, setChoferId] = useState(initial?.chofer.id ?? '');
  const [celadoraId, setCeladoraId] = useState(initial?.celadora?.id ?? '');
  const [puntoEncuentroId, setPuntoEncuentroId] = useState(
    initial?.puntoEncuentro?.id ?? '',
  );
  const [puntoMode, setPuntoMode] = useState<'ninguno' | 'existente' | 'nuevo'>(
    initial?.puntoEncuentro ? 'existente' : 'ninguno',
  );
  const [puntoNuevo, setPuntoNuevo] = useState({
    nombre: '',
    direccion: '',
    frecuente: false,
    lat: null as number | null,
    lon: null as number | null,
    usarCoordsParaChofer: false,
  });
  const [puntosEncuentro, setPuntosEncuentro] = useState<
    {
      id: string;
      nombre: string | null;
      direccion: string;
      frecuente: boolean;
      lat?: number | null;
      lon?: number | null;
      usarCoordsParaChofer?: boolean;
    }[]
  >(initial?.puntoEncuentro ? [initial.puntoEncuentro] : []);

  const [filas, setFilas] = useState<FilaBoard[]>(() =>
    initial?.filas?.length
      ? initial.filas.map((f) => ({
          ...mapGrillaFilaToForm(f),
          clientId: newClientId(),
          detalleManual: false,
        }))
      : [],
  );
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(
    initial?.updatedAt ?? null,
  );

  const [recursoAbierto, setRecursoAbierto] = useState<RecursoTipo | null>('vehiculos');
  const [submitting, setSubmitting] = useState(false);
  const [draggingKind, setDraggingKind] = useState<DragPayload['kind'] | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [slotHover, setSlotHover] = useState<
    'vehiculo' | 'chofer' | 'celadora' | 'paradas' | null
  >(null);
  const [optimizarToken, setOptimizarToken] = useState(0);
  const [filasAntesOptimizar, setFilasAntesOptimizar] = useState<FilaBoard[] | null>(null);
  const allowFilaDragRef = useRef(false);

  const transporte = useMemo(
    () => options.transportes.find((t) => t.id === transporteId) ?? null,
    [options.transportes, transporteId],
  );
  const chofer = useMemo(
    () =>
      options.choferes.find((c) => c.id === choferId) ??
      transporte?.choferes.find((c) => c.id === choferId) ??
      null,
    [options.choferes, transporte, choferId],
  );
  const celadora = useMemo(
    () =>
      options.celadoras.find((c) => c.id === celadoraId) ??
      transporte?.celadoras.find((c) => c.id === celadoraId) ??
      null,
    [options.celadoras, transporte, celadoraId],
  );

  const usedPasajeroIds = useMemo(
    () => new Set(filas.map((f) => f.pasajeroId).filter(Boolean)),
    [filas],
  );

  const mapaParadas: MapaParada[] = useMemo(() => {
    const stops: MapaParada[] = [];
    if (puntoMode === 'nuevo' && puntoNuevo.direccion.trim()) {
      stops.push({
        clientId: '__punto_encuentro__',
        label: puntoNuevo.nombre.trim() || 'Punto de encuentro',
        direccion: puntoNuevo.direccion.trim(),
        lat: puntoNuevo.lat,
        lon: puntoNuevo.lon,
      });
    } else if (puntoMode === 'existente' && puntoEncuentroId) {
      const p = puntosEncuentro.find((x) => x.id === puntoEncuentroId);
      if (p?.direccion) {
        stops.push({
          clientId: '__punto_encuentro__',
          label: p.nombre?.trim() || 'Punto de encuentro',
          direccion: p.direccion,
          lat: p.lat,
          lon: p.lon,
        });
      }
    }
    for (const f of filas) {
      if (!f.direccion.trim()) continue;
      stops.push({
        clientId: f.clientId,
        label: f.pasajeroNombre || f.direccion,
        direccion: f.direccion,
        lat: f.lat,
        lon: f.lon,
      });
    }
    return stops;
  }, [
    filas,
    puntoMode,
    puntoNuevo.direccion,
    puntoNuevo.nombre,
    puntoNuevo.lat,
    puntoNuevo.lon,
    puntoEncuentroId,
    puntosEncuentro,
  ]);

  /** Solo los pasajeros de ese destino que realmente viajan en esta grilla. */
  const nombresPasajerosDeDestino = (
    destinoId: string,
    pasajeroIdsEnGrilla?: Iterable<string>,
  ): string[] => {
    const enGrilla = new Set(pasajeroIdsEnGrilla ?? usedPasajeroIds);
    return options.pasajeros
      .filter((p) => (p.destinoIds ?? (p.destinoId ? [p.destinoId] : [])).includes(destinoId))
      .filter((p) => enGrilla.has(p.id))
      .map((p) => p.nombre);
  };

  const pasajerosEnGrillaKey = useMemo(
    () =>
      filas
        .filter((f) => f.tipoParada === 'pasajero' && f.pasajeroId)
        .map((f) => f.pasajeroId)
        .sort()
        .join(','),
    [filas],
  );

  /** Recalcula el detalle de los destinos según quiénes viajan en esta grilla. */
  useEffect(() => {
    setFilas((prev) => {
      const enGrilla = new Set(
        prev.filter((f) => f.tipoParada === 'pasajero' && f.pasajeroId).map((f) => f.pasajeroId),
      );
      let changed = false;
      const next = prev.map((fila) => {
        if (fila.tipoParada !== 'destino' || !fila.destinoId || fila.detalleManual) return fila;
        const destino = options.destinos.find((d) => d.id === fila.destinoId);
        if (!destino) return fila;
        const detalle = buildDetalleDestino({
          destinoNombre: destino.nombre,
          accion: fila.accion,
          pasajeroNombres: nombresPasajerosDeDestino(fila.destinoId, enGrilla),
        });
        if (detalle === fila.pasajeroNombre) return fila;
        changed = true;
        return { ...fila, pasajeroNombre: detalle };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depende de los pasajeros presentes
  }, [pasajerosEnGrillaKey, options.destinos, options.pasajeros]);

  useEffect(() => {
    if (!celadoraId) {
      setPuntosEncuentro([]);
      setPuntoMode('ninguno');
      setPuntoEncuentroId('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/administracion/puntos-encuentro?celadoraId=${encodeURIComponent(celadoraId)}`,
        );
        const body = await response.json();
        if (!response.ok || cancelled) return;
        setPuntosEncuentro(
          (body.data as {
            id: string;
            nombre: string | null;
            direccion: string;
            frecuente: boolean;
          }[]) ?? [],
        );
      } catch {
        if (!cancelled) setPuntosEncuentro([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [celadoraId]);

  const toggleRecurso = (tipo: RecursoTipo) => {
    setRecursoAbierto((current) => (current === tipo ? null : tipo));
  };

  const assignVehiculo = (id: string) => {
    setTransporteId(id);
    const t = options.transportes.find((x) => x.id === id);
    if (t && !choferId) {
      const preferred =
        t.choferes[0]?.id ||
        options.choferes.find((c) => c.transporteId === id)?.id ||
        '';
      if (preferred) setChoferId(preferred);
    }
  };

  const assignCeladora = (id: string) => {
    setCeladoraId(id);
    setPuntoMode('ninguno');
    setPuntoEncuentroId('');
    setPuntoNuevo({
      nombre: '',
      direccion: '',
      frecuente: false,
      lat: null,
      lon: null,
      usarCoordsParaChofer: false,
    });
  };

  const addPasajeroFila = (pasajeroId: string) => {
    if (usedPasajeroIds.has(pasajeroId)) return;
    const p = options.pasajeros.find((x) => x.id === pasajeroId);
    if (!p) return;
    const accion = accionPorTipoParada('pasajero', tipoItinerario);
    setFilas((prev) => [
      ...prev,
      {
        clientId: newClientId(),
        tipoParada: 'pasajero',
        hora: '',
        direccion: p.direccion,
        pasajeroNombre: p.nombre,
        detalleManual: false,
        pasajeroId: p.id,
        destinoId: '',
        accion,
        trasbordoHacia: '',
        lat: p.lat ?? null,
        lon: p.lon ?? null,
        usarCoordsParaChofer: Boolean(p.usarCoordsParaChofer),
      },
    ]);
  };

  const addDestinoFila = (destinoId: string) => {
    const d = options.destinos.find((x) => x.id === destinoId);
    if (!d) return;
    const accion = accionPorTipoParada('destino', tipoItinerario);
    setFilas((prev) => [
      ...prev,
      {
        clientId: newClientId(),
        tipoParada: 'destino',
        hora: '',
        direccion: d.domicilio,
        pasajeroNombre: buildDetalleDestino({
          destinoNombre: d.nombre,
          accion,
          pasajeroNombres: nombresPasajerosDeDestino(destinoId),
        }),
        detalleManual: false,
        pasajeroId: '',
        destinoId: d.id,
        accion,
        trasbordoHacia: '',
        lat: d.lat ?? null,
        lon: d.lon ?? null,
        usarCoordsParaChofer: Boolean(d.usarCoordsParaChofer),
      },
    ]);
  };

  const handleModalidadChange = (next: ModalidadItinerario | 'INGRESO' | 'SALIDA') => {
    const prevTipo = tipoItinerario;
    let nextModalidad: ModalidadItinerario = modalidad;
    let nextSentido: SentidoItinerario | '' = sentido;

    if (next === 'INGRESO') {
      nextModalidad = 'NORMAL';
      nextSentido = 'INGRESO';
    } else if (next === 'SALIDA') {
      nextModalidad = 'NORMAL';
      nextSentido = 'SALIDA';
    } else if (next === 'ADAPTACION') {
      nextModalidad = 'ADAPTACION';
      nextSentido = sentido === 'SALIDA' ? 'SALIDA' : 'INGRESO';
    } else {
      nextModalidad = 'ESPECIAL';
      nextSentido = '';
    }

    setModalidad(nextModalidad);
    setSentido(nextSentido);
    const nextTipo = buildTipoItinerario(nextModalidad, nextSentido);
    applySentidoToFilas(prevTipo, nextTipo);
  };

  const handleSentidoChange = (next: SentidoItinerario | '') => {
    const prevTipo = tipoItinerario;
    setSentido(next);
    const nextTipo = buildTipoItinerario(modalidad, next);
    applySentidoToFilas(prevTipo, nextTipo);
  };

  const applySentidoToFilas = (prevTipo: TipoItinerario, nextTipo: TipoItinerario) => {
    const prevSentido = isSalidaItinerario(prevTipo) ? 'SALIDA' : 'INGRESO';
    const nextSentido = isSalidaItinerario(nextTipo) ? 'SALIDA' : 'INGRESO';
    if (prevSentido === nextSentido) return;
    setFilas((list) =>
      list.map((fila) => {
        if (fila.tipoParada === 'trasbordo') return fila;
        const accion =
          fila.accion === 'SUBE' ? 'BAJA' : fila.accion === 'BAJA' ? 'SUBE' : fila.accion;
        if (fila.tipoParada === 'destino' && fila.destinoId) {
          if (fila.detalleManual) return { ...fila, accion };
          const destino = options.destinos.find((d) => d.id === fila.destinoId);
          return {
            ...fila,
            accion,
            pasajeroNombre: buildDetalleDestino({
              destinoNombre: destino?.nombre ?? fila.pasajeroNombre,
              accion,
              pasajeroNombres: nombresPasajerosDeDestino(fila.destinoId),
            }),
          };
        }
        return { ...fila, accion };
      }),
    );
  };

  const onDropRecurso = (slot: 'vehiculo' | 'chofer' | 'celadora' | 'paradas', e: DragEvent) => {
    e.preventDefault();
    setSlotHover(null);
    const payload = readDragPayload(e);
    if (!payload) return;

    if (slot === 'vehiculo' && payload.kind === 'vehiculo') assignVehiculo(payload.id);
    if (slot === 'chofer' && payload.kind === 'chofer') setChoferId(payload.id);
    if (slot === 'celadora' && payload.kind === 'celadora') assignCeladora(payload.id);
    if (slot === 'paradas') {
      if (payload.kind === 'pasajero') addPasajeroFila(payload.id);
      if (payload.kind === 'destino') addDestinoFila(payload.id);
    }
    setDraggingKind(null);
  };

  const reorderFila = (fromClientId: string, toIndex: number) => {
    setFilas((prev) => {
      const fromIndex = prev.findIndex((f) => f.clientId === fromClientId);
      if (fromIndex < 0 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const validate = (): string | null => {
    const headerMissing = missingFieldsMessage(
      {
        nombre,
        areaId,
        tipoItinerario,
        fecha,
        transporteId,
        choferId,
      },
      {
        nombre: 'nombre de la grilla',
        areaId: 'área',
        tipoItinerario: 'tipo de itinerario',
        fecha: 'fecha',
        transporteId: 'vehículo',
        choferId: 'chofer',
      },
    );
    if (headerMissing) return headerMissing;

    if (celadoraId && puntoMode === 'nuevo' && !puntoNuevo.direccion.trim()) {
      return 'Indicá la dirección del punto de encuentro.';
    }
    if (celadoraId && puntoMode === 'existente' && !puntoEncuentroId) {
      return 'Elegí un punto de encuentro o creá uno nuevo.';
    }
    if (filas.length === 0) {
      return 'Arrastrá al menos un pasajero o destino a la grilla.';
    }
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const n = i + 1;
      if (fila.tipoParada === 'destino' && !fila.hora.trim()) {
        return `Indicá la hora del destino (fila ${n}).`;
      }
      if (!fila.direccion.trim() || !fila.pasajeroNombre.trim()) {
        return `Completá dirección y detalle (fila ${n}).`;
      }
    }
    return null;
  };

  const resolvePuntoEncuentroId = async (): Promise<string | null> => {
    if (!celadoraId) return null;
    if (puntoMode === 'existente' && puntoEncuentroId) {
      const p = puntosEncuentro.find((x) => x.id === puntoEncuentroId);
      if (p && (p.lat != null || p.usarCoordsParaChofer != null)) {
        await fetch(`/api/administracion/puntos-encuentro/${puntoEncuentroId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: p.lat ?? null,
            lon: p.lon ?? null,
            usarCoordsParaChofer: Boolean(p.usarCoordsParaChofer),
          }),
        });
      }
      return puntoEncuentroId;
    }
    if (puntoMode === 'nuevo') {
      const puntoRes = await fetch('/api/administracion/puntos-encuentro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celadoraId,
          direccion: puntoNuevo.direccion,
          nombre: puntoNuevo.nombre || null,
          frecuente: puntoNuevo.frecuente,
          lat: puntoNuevo.lat,
          lon: puntoNuevo.lon,
          usarCoordsParaChofer: puntoNuevo.usarCoordsParaChofer,
        }),
      });
      if (!puntoRes.ok) {
        throw new Error(await readApiError(puntoRes, 'No se pudo crear el punto de encuentro.'));
      }
      const puntoBody = (await puntoRes.json()) as { data: { id: string } };
      return puntoBody.data.id;
    }
    return null;
  };

  const applyCoordsToPunto = (
    coords: { lat: number; lon: number },
    opts?: { usarCoordsParaChofer?: boolean },
  ) => {
    if (puntoMode === 'nuevo') {
      setPuntoNuevo((p) => ({
        ...p,
        lat: coords.lat,
        lon: coords.lon,
        usarCoordsParaChofer:
          opts?.usarCoordsParaChofer !== undefined
            ? opts.usarCoordsParaChofer
            : p.usarCoordsParaChofer,
      }));
      return;
    }
    if (puntoMode === 'existente' && puntoEncuentroId) {
      setPuntosEncuentro((list) =>
        list.map((p) =>
          p.id === puntoEncuentroId
            ? {
                ...p,
                lat: coords.lat,
                lon: coords.lon,
                usarCoordsParaChofer:
                  opts?.usarCoordsParaChofer !== undefined
                    ? opts.usarCoordsParaChofer
                    : Boolean(p.usarCoordsParaChofer),
              }
            : p,
        ),
      );
    }
  };

  const applyCoordsToFila = (
    clientId: string,
    coords: { lat: number; lon: number },
    opts?: { usarCoordsParaChofer?: boolean },
  ) => {
    if (clientId === '__punto_encuentro__') {
      applyCoordsToPunto(coords, opts);
      return;
    }
    setFilas((prev) =>
      prev.map((f) =>
        f.clientId === clientId
          ? {
              ...f,
              lat: coords.lat,
              lon: coords.lon,
              usarCoordsParaChofer:
                opts?.usarCoordsParaChofer !== undefined
                  ? opts.usarCoordsParaChofer
                  : f.usarCoordsParaChofer,
            }
          : f,
      ),
    );
  };

  const handleCoordsGeocoded = (clientId: string, coords: { lat: number; lon: number }) => {
    applyCoordsToFila(clientId, coords);
  };

  const handlePinAdjusted = async (clientId: string, coords: { lat: number; lon: number }) => {
    // Guardar pin de inmediato (mapa interno); el texto de dirección no cambia.
    applyCoordsToFila(clientId, coords, { usarCoordsParaChofer: false });

    const label =
      clientId === '__punto_encuentro__'
        ? 'punto de encuentro'
        : filas.find((f) => f.clientId === clientId)?.pasajeroNombre || 'esta parada';

    const aplicar = await popup.confirm({
      title: 'Ubicación ajustada',
      message: `Se guardó el pin de “${label}” para el mapa interno (la dirección de texto no cambia).\n\n¿Querés usar también esta ubicación en Maps/Waze del chofer?`,
      confirmLabel: 'Sí, para el chofer',
      cancelLabel: 'Solo mapa interno',
    });

    if (aplicar) {
      applyCoordsToFila(clientId, coords, { usarCoordsParaChofer: true });
      popup.success('Listo: el chofer abrirá Maps/Waze en este punto.');
    }
  };

  const handleSugerirHorarios = () => {
    const tieneAncla = filas.some((f) => f.destinoId && f.hora.trim());
    if (!tieneAncla) {
      popup.error(
        'Para sugerir horarios, primero cargá la hora en al menos un destino de la grilla.',
      );
      return;
    }
    const sugeridas = sugerirHorariosHaciaAtras(
      filas.map((f) => ({ hora: f.hora || null, destinoId: f.destinoId || null })),
      15,
    );
    const next = filas.map((f, i) => {
      if (f.hora.trim() || !sugeridas[i]) return f;
      return { ...f, hora: sugeridas[i]! };
    });
    const aplicadas = next.filter((f, i) => f.hora !== filas[i]?.hora).length;
    if (aplicadas === 0) {
      popup.error('No había paradas sin horario para completar.');
      return;
    }
    setFilas(next);
    popup.success(`Se sugirieron ${aplicadas} horario(s) hacia atrás (15 min entre paradas).`);
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      popup.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const resolvedPunto = await resolvePuntoEncuentroId();
      const payload = {
        nombre: nombre.trim(),
        tipoItinerario,
        fecha,
        nota: nota.trim() || null,
        areaId,
        transporteId,
        choferId,
        conCeladora: Boolean(celadoraId),
        celadoraId: celadoraId || null,
        puntoEncuentroId: resolvedPunto,
        salidaDeBase,
        retornoABase,
        expectedUpdatedAt: !isNew ? expectedUpdatedAt : undefined,
        filas: filas.map((f) => ({
          hora: f.hora || null,
          direccion: f.direccion,
          pasajeroNombre: f.pasajeroNombre,
          pasajeroId: f.pasajeroId || null,
          destinoId: f.destinoId || null,
          accion: f.accion,
          trasbordoHacia: f.accion === 'TRASBORDO' ? f.trasbordoHacia || null : null,
          lat: f.lat,
          lon: f.lon,
          usarCoordsParaChofer: f.usarCoordsParaChofer,
        })),
      };

      const saveOnce = async (forceReassign: boolean) =>
        fetch(isNew ? '/api/administracion/grillas' : `/api/administracion/grillas/${initial!.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            forceReassign,
            ...(aprobarDespues && !isNew ? { aprobarDespues: true } : {}),
          }),
        });

      let response = await saveOnce(false);
      if (response.status === 409) {
        const conflictBody = (await response.json()) as {
          message?: string;
          code?: string;
          canForce?: boolean;
        };
        if (conflictBody.code === 'STALE_VERSION') {
          popup.error(
            conflictBody.message ??
              'Otro usuario modificó esta grilla. Volvé a abrirla para ver los cambios.',
          );
          return;
        }
        if (conflictBody.canForce === false) {
          popup.error(
            conflictBody.message ??
              'Hay un conflicto que no se puede reasignar automáticamente.',
          );
          return;
        }
        const ok = await popup.confirm({
          title: 'Recurso ya asignado',
          message:
            conflictBody.message ??
            'Este recurso ya está asignado en otra área. ¿Desea reasignarlo aquí?',
          confirmLabel: 'Sí, reasignar',
          cancelLabel: 'Cancelar',
        });
        if (!ok) return;
        response = await saveOnce(true);
      }

      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo guardar la grilla.'));
        return;
      }
      const body = (await response.json()) as {
        message?: string;
        data?: { updatedAt?: string };
      };
      if (body.data?.updatedAt) {
        setExpectedUpdatedAt(body.data.updatedAt);
      }
      popup.success(body.message ?? (isNew ? 'Grilla creada.' : 'Grilla actualizada.'));
      onSaved();
    } catch (err) {
      popup.error(err instanceof Error ? err.message : 'Error de conexión al guardar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initial) {
      onCancel();
      return;
    }
    const ok = await popup.confirm({
      message: `¿Eliminar la grilla "${initial.nombre || 'sin nombre'}"?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/administracion/grillas/${initial.id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar la grilla.'));
      return;
    }
    popup.success('Grilla eliminada.');
    onDeleted?.();
  };

  const cargarSalidaDesdeIngreso = async () => {
    if (!areaId || !fecha) {
      popup.error('Elegí área y fecha antes de cargar desde Ingresos.');
      return;
    }
    setSubmitting(true);
    try {
      const params = new URLSearchParams({ areaId, fecha, targetTipo: tipoItinerario });
      if (transporteId) params.set('transporteId', transporteId);
      const response = await fetch(`/api/administracion/grillas/desde-ingreso?${params}`);
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo armar la Salida.'));
        return;
      }
      const body = (await response.json()) as {
        message?: string;
        data: {
          sugerido: {
            tipoItinerario: TipoItinerario;
            fecha: string;
            nota: string | null;
            conCeladora: boolean;
            transporteId: string;
            choferId: string;
            celadoraId: string | null;
            filas: {
              tipoParada: TipoParadaForm;
              hora: string;
              direccion: string;
              pasajeroNombre: string;
              pasajeroId: string | null;
              destinoId: string | null;
              accion: AccionParada;
              trasbordoHacia: string | null;
            }[];
          };
        };
      };
      const s = body.data.sugerido;
      const split = splitTipoItinerario(s.tipoItinerario);
      setModalidad(split.modalidad);
      setSentido(split.sentido || 'SALIDA');
      setFecha(s.fecha);
      setNota(s.nota ?? '');
      setTransporteId(s.transporteId);
      setChoferId(s.choferId);
      setCeladoraId(s.celadoraId ?? '');
      setPuntoMode('ninguno');
      setPuntoEncuentroId('');
      setFilas(
        s.filas.map((f) => ({
          clientId: newClientId(),
          tipoParada: f.tipoParada,
          hora: f.hora ?? '',
          direccion: f.direccion,
          pasajeroNombre: f.pasajeroNombre,
          detalleManual: false,
          pasajeroId: f.pasajeroId ?? '',
          destinoId: f.destinoId ?? '',
          accion: f.accion,
          trasbordoHacia: f.trasbordoHacia ?? '',
          lat: null,
          lon: null,
          usarCoordsParaChofer: false,
        })),
      );
      popup.success(body.message ?? 'Salida armada desde Ingresos.');
    } catch {
      popup.error('Error de conexión al armar la Salida.');
    } finally {
      setSubmitting(false);
    }
  };

  const recursoSections: { key: RecursoTipo; label: string; count: number }[] = [
    { key: 'vehiculos', label: 'Vehículos', count: options.transportes.length },
    { key: 'choferes', label: 'Choferes', count: options.choferes.length },
    { key: 'celadoras', label: 'Celadoras', count: options.celadoras.length },
    { key: 'pasajeros', label: 'Pasajeros', count: options.pasajeros.length },
    { key: 'destinos', label: 'Destinos', count: options.destinos.length },
  ];

  const renderRecursoCards = (section: RecursoTipo) => {
    if (section === 'vehiculos') {
      return options.transportes.map((t) => {
        const used = t.id === transporteId;
        return (
          <div
            key={t.id}
            className={`grilla-recurso-card${used ? ' is-used' : ''}`}
            draggable={!used}
            onDragStart={(e) => {
              if (used) {
                e.preventDefault();
                return;
              }
              setDragPayload(e, { kind: 'vehiculo', id: t.id });
              setDraggingKind('vehiculo');
            }}
            onDragEnd={() => setDraggingKind(null)}
          >
            <strong>{t.nombre}</strong>
            <small>{t.tipo}</small>
          </div>
        );
      });
    }
    if (section === 'choferes') {
      return options.choferes.map((c) => {
        const used = c.id === choferId;
        return (
          <div
            key={c.id}
            className={`grilla-recurso-card${used ? ' is-used' : ''}`}
            draggable={!used}
            onDragStart={(e) => {
              if (used) {
                e.preventDefault();
                return;
              }
              setDragPayload(e, { kind: 'chofer', id: c.id });
              setDraggingKind('chofer');
            }}
            onDragEnd={() => setDraggingKind(null)}
          >
            <strong>{c.username}</strong>
          </div>
        );
      });
    }
    if (section === 'celadoras') {
      return options.celadoras.map((c) => {
        const used = c.id === celadoraId;
        return (
          <div
            key={c.id}
            className={`grilla-recurso-card${used ? ' is-used' : ''}`}
            draggable={!used}
            onDragStart={(e) => {
              if (used) {
                e.preventDefault();
                return;
              }
              setDragPayload(e, { kind: 'celadora', id: c.id });
              setDraggingKind('celadora');
            }}
            onDragEnd={() => setDraggingKind(null)}
          >
            <strong>{c.username}</strong>
          </div>
        );
      });
    }
    if (section === 'pasajeros') {
      return options.pasajeros.map((p) => {
        const used = usedPasajeroIds.has(p.id);
        return (
          <div
            key={p.id}
            className={`grilla-recurso-card${used ? ' is-used' : ''}`}
            draggable={!used}
            onDragStart={(e) => {
              if (used) {
                e.preventDefault();
                return;
              }
              setDragPayload(e, { kind: 'pasajero', id: p.id });
              setDraggingKind('pasajero');
            }}
            onDragEnd={() => setDraggingKind(null)}
          >
            <strong>{p.nombre}</strong>
            <small>{p.direccion}</small>
          </div>
        );
      });
    }
    return options.destinos.map((d) => (
      <div
        key={d.id}
        className="grilla-recurso-card"
        draggable
        onDragStart={(e) => {
          setDragPayload(e, { kind: 'destino', id: d.id });
          setDraggingKind('destino');
        }}
        onDragEnd={() => setDraggingKind(null)}
      >
        <strong>{d.nombre}</strong>
        <small>{d.domicilio}</small>
      </div>
    ));
  };

  return (
    <section className="panel-card grilla-tablero">
      <div className="grilla-tablero__header">
        <div>
          <h2>{isNew ? 'Nueva grilla' : 'Editar grilla'}</h2>
          <p className="panel-card__desc">
            Arrastrá recursos desde la izquierda hacia la grilla. El orden de las paradas es el del
            arrastre; después podés reordenarlas.
          </p>
        </div>
        <div className="grilla-tablero__header-actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={onCancel}>
            Volver al listado
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={handleSugerirHorarios}
            disabled={submitting || filas.length === 0}
            title="Completa horarios vacíos hacia atrás desde destinos con hora (15 min)"
          >
            Sugerir horarios
          </button>
          {!isNew && allowDelete && (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => void handleDelete()}
              disabled={submitting}
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : 'Guardar grilla'}
          </button>
        </div>
      </div>

      <div className="grilla-tablero__meta">
        <div className="form-group">
          <label htmlFor="tb-nombre">Nombre</label>
          <input
            id="tb-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Mañana SM"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="tb-tipo">Itinerario</label>
          <select
            id="tb-tipo"
            value={
              modalidad === 'NORMAL'
                ? sentido === 'SALIDA'
                  ? 'SALIDA'
                  : 'INGRESO'
                : modalidad
            }
            onChange={(e) =>
              handleModalidadChange(
                e.target.value as ModalidadItinerario | 'INGRESO' | 'SALIDA',
              )
            }
          >
            <option value="INGRESO">Ingresos</option>
            <option value="SALIDA">Salidas</option>
            <option value="ADAPTACION">Adaptación</option>
            <option value="ESPECIAL">Especial</option>
          </select>
        </div>

        {(modalidad === 'ADAPTACION' || modalidad === 'ESPECIAL') && (
          <div className="form-group">
            <label htmlFor="tb-sentido">
              {modalidad === 'ADAPTACION' ? 'Sentido (Adaptación)' : 'Sentido (Especial)'}
            </label>
            <select
              id="tb-sentido"
              value={sentido}
              onChange={(e) =>
                handleSentidoChange(e.target.value as SentidoItinerario | '')
              }
            >
              {modalidad === 'ESPECIAL' && (
                <option value="">Sin definir (como Ingreso)</option>
              )}
              <option value="INGRESO">Ingreso</option>
              <option value="SALIDA">Salida</option>
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="tb-fecha">Fecha</label>
          <input
            id="tb-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        {isSalidaItinerario(tipoItinerario) && (
          <div className="form-group grilla-tablero__desde-ingreso">
            <label>&nbsp;</label>
            <button
              type="button"
              className="btn btn--outline"
              disabled={submitting}
              onClick={() => void cargarSalidaDesdeIngreso()}
            >
              Cargar desde Ingresos
            </button>
          </div>
        )}
        <div className="form-group grilla-tablero__nota">
          <label htmlFor="tb-nota">Nota (opcional)</label>
          <input
            id="tb-nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota del día"
          />
        </div>
        <div className="form-group grilla-tablero__base-flags">
          <label>Base LC</label>
          <div className="admin-users__role-checks" style={{ marginTop: '0.35rem' }}>
            <label className="admin-users__role-check">
              <input
                type="checkbox"
                checked={salidaDeBase}
                onChange={(e) => setSalidaDeBase(e.target.checked)}
              />
              Salida de base
            </label>
            <label className="admin-users__role-check">
              <input
                type="checkbox"
                checked={retornoABase}
                onChange={(e) => setRetornoABase(e.target.checked)}
              />
              Retorno a base
            </label>
          </div>
          {(salidaDeBase || retornoABase) && (
            <p className="panel-card__desc" style={{ margin: '0.35rem 0 0' }}>
              {(() => {
                const base = options.destinos.find((d) => /^base\s*lc$/i.test(d.nombre.trim()));
                return base
                  ? `Dirección Base LC: ${base.domicilio}`
                  : 'Creá el destino activo “Base LC” en Admin → Áreas para usar su domicilio.';
              })()}
            </p>
          )}
        </div>
      </div>

      <div className="grilla-tablero__layout">
        <aside className="grilla-tablero__recursos">
          <h3>Recursos</h3>
          <p className="grilla-tablero__hint">Elegí un tipo, arrastrá y cerrá el listado.</p>
          {recursoSections.map((section) => (
            <div key={section.key} className="grilla-recurso-acc">
              <button
                type="button"
                className={`grilla-recurso-acc__toggle${recursoAbierto === section.key ? ' is-open' : ''}`}
                onClick={() => toggleRecurso(section.key)}
                aria-expanded={recursoAbierto === section.key}
              >
                <span>
                  <span aria-hidden="true">{recursoAbierto === section.key ? '▼' : '▶'}</span>{' '}
                  {section.label}
                </span>
                <span className="grilla-recurso-acc__count">{section.count}</span>
              </button>
              {recursoAbierto === section.key && (
                <div className="grilla-recurso-acc__body">
                  {renderRecursoCards(section.key)}
                  {section.count === 0 && (
                    <p className="grilla-tablero__empty">No hay recursos de este tipo en el área.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </aside>

        <div className="grilla-tablero__board">
          <div className="grilla-board-section">
            <h3>Recursos asignados</h3>
            <div className="grilla-slots">
              <div
                className={`grilla-slot${slotHover === 'vehiculo' ? ' is-drop-target' : ''}${
                  draggingKind === 'vehiculo' ? ' is-accepting' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSlotHover('vehiculo');
                }}
                onDragLeave={() => setSlotHover((h) => (h === 'vehiculo' ? null : h))}
                onDrop={(e) => onDropRecurso('vehiculo', e)}
              >
                <span className="grilla-slot__label">Vehículo</span>
                {transporte ? (
                  <div className="grilla-slot__value">
                    <strong>{transporte.nombre}</strong>
                    <small>{transporte.tipo}</small>
                    <button
                      type="button"
                      className="grilla-slot__clear"
                      aria-label="Quitar vehículo"
                      onClick={() => setTransporteId('')}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <p className="grilla-slot__placeholder">Soltá un vehículo acá</p>
                )}
              </div>

              <div
                className={`grilla-slot${slotHover === 'chofer' ? ' is-drop-target' : ''}${
                  draggingKind === 'chofer' ? ' is-accepting' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSlotHover('chofer');
                }}
                onDragLeave={() => setSlotHover((h) => (h === 'chofer' ? null : h))}
                onDrop={(e) => onDropRecurso('chofer', e)}
              >
                <span className="grilla-slot__label">Chofer</span>
                {chofer ? (
                  <div className="grilla-slot__value">
                    <strong>{chofer.username}</strong>
                    <button
                      type="button"
                      className="grilla-slot__clear"
                      aria-label="Quitar chofer"
                      onClick={() => setChoferId('')}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <p className="grilla-slot__placeholder">Soltá un chofer acá</p>
                )}
              </div>

              <div
                className={`grilla-slot${slotHover === 'celadora' ? ' is-drop-target' : ''}${
                  draggingKind === 'celadora' ? ' is-accepting' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSlotHover('celadora');
                }}
                onDragLeave={() => setSlotHover((h) => (h === 'celadora' ? null : h))}
                onDrop={(e) => onDropRecurso('celadora', e)}
              >
                <span className="grilla-slot__label">Celadora (opcional)</span>
                {celadora ? (
                  <div className="grilla-slot__value">
                    <strong>{celadora.username}</strong>
                    <button
                      type="button"
                      className="grilla-slot__clear"
                      aria-label="Quitar celadora"
                      onClick={() => {
                        setCeladoraId('');
                        setPuntoMode('ninguno');
                        setPuntoEncuentroId('');
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <p className="grilla-slot__placeholder">Soltá una celadora acá</p>
                )}
              </div>
            </div>

            {celadoraId && (
              <div className="grilla-punto">
                <div className="form-group">
                  <label htmlFor="tb-punto-mode">Punto de encuentro</label>
                  <select
                    id="tb-punto-mode"
                    value={puntoMode}
                    onChange={(e) => {
                      const mode = e.target.value as 'ninguno' | 'existente' | 'nuevo';
                      setPuntoMode(mode);
                      if (mode !== 'existente') setPuntoEncuentroId('');
                    }}
                  >
                    <option value="ninguno">Sin punto (parte de base)</option>
                    <option value="existente" disabled={puntosEncuentro.length === 0}>
                      Usar frecuente
                      {puntosEncuentro.length === 0 ? ' (sin guardados)' : ''}
                    </option>
                    <option value="nuevo">Crear punto nuevo</option>
                  </select>
                </div>
                {puntoMode === 'existente' && (
                  <div className="form-group">
                    <label htmlFor="tb-punto">Punto guardado</label>
                    <select
                      id="tb-punto"
                      value={puntoEncuentroId}
                      onChange={(e) => setPuntoEncuentroId(e.target.value)}
                    >
                      <option value="">Seleccionar</option>
                      {puntosEncuentro.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre ? `${p.nombre} — ${p.direccion}` : p.direccion}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {puntoMode === 'nuevo' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="tb-punto-dir">Dirección</label>
                      <input
                        id="tb-punto-dir"
                        value={puntoNuevo.direccion}
                        onChange={(e) =>
                          setPuntoNuevo((p) => ({ ...p, direccion: e.target.value }))
                        }
                        placeholder="Calle, número, localidad"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tb-punto-nombre">Nombre (opcional)</label>
                      <input
                        id="tb-punto-nombre"
                        value={puntoNuevo.nombre}
                        onChange={(e) => setPuntoNuevo((p) => ({ ...p, nombre: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tb-punto-freq">¿Guardar como frecuente?</label>
                      <select
                        id="tb-punto-freq"
                        value={puntoNuevo.frecuente ? 'si' : 'no'}
                        onChange={(e) =>
                          setPuntoNuevo((p) => ({ ...p, frecuente: e.target.value === 'si' }))
                        }
                      >
                        <option value="no">No, solo esta grilla</option>
                        <option value="si">Sí, reutilizar después</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            className={`grilla-board-section grilla-board-section--paradas${
              slotHover === 'paradas' ? ' is-drop-target' : ''
            }`}
            onDragOver={(e) => {
              if (
                draggingKind === 'pasajero' ||
                draggingKind === 'destino' ||
                draggingKind === 'fila'
              ) {
                e.preventDefault();
                setSlotHover('paradas');
              }
            }}
            onDragLeave={() => setSlotHover((h) => (h === 'paradas' ? null : h))}
            onDrop={(e) => onDropRecurso('paradas', e)}
          >
            <h3>Paradas</h3>
            <p className="grilla-tablero__hint">
              Arrastrá pasajeros o destinos acá. Reordená con el asa ∷.
            </p>

            {filas.length === 0 ? (
              <p className="grilla-tablero__empty">Todavía no hay paradas en esta grilla.</p>
            ) : (
              filas.map((fila, index) => (
                <div
                  key={fila.clientId}
                  className={[
                    'grilla-fila',
                    'grilla-fila--board',
                    dropTargetId === fila.clientId ? 'is-drop-target' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable={filas.length > 1}
                  onDragStart={(e) => {
                    if (!allowFilaDragRef.current) {
                      e.preventDefault();
                      return;
                    }
                    setDragPayload(e, { kind: 'fila', clientId: fila.clientId });
                    setDraggingKind('fila');
                  }}
                  onDragEnd={() => {
                    setDraggingKind(null);
                    setDropTargetId(null);
                    allowFilaDragRef.current = false;
                  }}
                  onDragOver={(e) => {
                    if (draggingKind === 'fila') {
                      e.preventDefault();
                      setDropTargetId(fila.clientId);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropTargetId === fila.clientId) setDropTargetId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = readDragPayload(e);
                    setDropTargetId(null);
                    setSlotHover(null);
                    if (payload?.kind === 'fila') {
                      reorderFila(payload.clientId, index);
                    } else if (payload?.kind === 'pasajero') {
                      addPasajeroFila(payload.id);
                    } else if (payload?.kind === 'destino') {
                      addDestinoFila(payload.id);
                    }
                    setDraggingKind(null);
                  }}
                >
                  <span
                    className="grilla-fila__handle"
                    role="button"
                    tabIndex={filas.length > 1 ? 0 : -1}
                    title="Arrastra para cambiar el orden"
                    aria-label={`Arrastrar fila ${index + 1}`}
                    onPointerDown={() => {
                      allowFilaDragRef.current = filas.length > 1;
                    }}
                  >
                    <span className="grilla-fila__handle-icon" aria-hidden="true" />
                  </span>

                  <div className="form-group grilla-fila__hora">
                    <label>Hora{fila.tipoParada === 'destino' ? '' : ' (opc.)'}</label>
                    <input
                      type="time"
                      value={fila.hora}
                      onChange={(e) =>
                        setFilas((prev) =>
                          prev.map((f, i) =>
                            i === index ? { ...f, hora: e.target.value } : f,
                          ),
                        )
                      }
                      required={fila.tipoParada === 'destino'}
                    />
                  </div>

                  <div className="form-group grilla-fila__detalle">
                    <label>Detalle</label>
                    <input
                      value={fila.pasajeroNombre}
                      onChange={(e) =>
                        setFilas((prev) =>
                          prev.map((f, i) =>
                            i === index
                              ? { ...f, pasajeroNombre: e.target.value, detalleManual: true }
                              : f,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="form-group grilla-fila__accion">
                    <label>Acción</label>
                    <select
                      value={fila.accion}
                      onChange={(e) => {
                        const accion = e.target.value as AccionParada;
                        setFilas((prev) =>
                          prev.map((f, i) => {
                            if (i !== index) return f;
                            if (
                              f.tipoParada === 'destino' &&
                              f.destinoId &&
                              !f.detalleManual &&
                              accion !== 'TRASBORDO'
                            ) {
                              const destino = options.destinos.find((d) => d.id === f.destinoId);
                              return {
                                ...f,
                                accion,
                                pasajeroNombre: buildDetalleDestino({
                                  destinoNombre: destino?.nombre ?? f.pasajeroNombre,
                                  accion,
                                  pasajeroNombres: nombresPasajerosDeDestino(f.destinoId),
                                }),
                              };
                            }
                            return { ...f, accion };
                          }),
                        );
                      }}
                    >
                      <option value="SUBE">Sube</option>
                      <option value="BAJA">Baja</option>
                      <option value="TRASBORDO">Trasbordo</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn--danger btn--sm grilla-fila__quitar"
                    onClick={() =>
                      setFilas((prev) => prev.filter((f) => f.clientId !== fila.clientId))
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <section className="grilla-board-section grilla-board-section--mapa">
        <div className="grilla-mapa__toolbar">
          <div>
            <h3>Mapa</h3>
            <p className="grilla-tablero__hint">
              Vista del recorrido según el orden de las paradas
              {puntoMode !== 'ninguno' ? ' (incluye punto de encuentro)' : ''}.
            </p>
          </div>
          <div className="grilla-mapa__toolbar-actions">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={filas.length < 3}
              onClick={() => {
                setFilasAntesOptimizar(filas.map((f) => ({ ...f })));
                setOptimizarToken((t) => t + 1);
              }}
            >
              Optimizar recorrido
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={!filasAntesOptimizar}
              onClick={() => {
                if (!filasAntesOptimizar) return;
                setFilas(filasAntesOptimizar);
                setFilasAntesOptimizar(null);
                popup.success('Se descartó la optimización.');
              }}
            >
              Descartar optimización
            </button>
          </div>
        </div>
        <GrillaMapa
          paradas={mapaParadas}
          optimizarToken={optimizarToken}
          onCoordsGeocoded={handleCoordsGeocoded}
          onPinAdjusted={(clientId, coords) => {
            void handlePinAdjusted(clientId, coords);
          }}
          onOrdenOptimizado={(ordenIds) => {
            setFilas((prev) => {
              const byId = new Map(prev.map((f) => [f.clientId, f]));
              const next: FilaBoard[] = [];
              for (const id of ordenIds) {
                if (id === '__punto_encuentro__') continue;
                const fila = byId.get(id);
                if (fila) next.push(fila);
              }
              for (const f of prev) {
                if (!next.some((x) => x.clientId === f.clientId)) next.push(f);
              }
              return next;
            });
            popup.success('Paradas reordenadas según la ruta optimizada. Podés descartarla si no convence.');
          }}
          onError={(message) => popup.error(message)}
        />
      </section>
      {popup.popupNode}
    </section>
  );
}
