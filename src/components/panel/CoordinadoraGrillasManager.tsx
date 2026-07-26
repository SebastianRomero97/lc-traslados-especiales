'use client';

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import {
  accionPorTipoParada,
  buildDetalleDestino,
  buildGrillaTitulo,
  buildGrillaWhatsAppText,
  formatAccionFila,
  formatFechaGrilla,
  fechaGrillaKey,
  invertirAccionSubeBaja,
  mapGrillaFilaToForm,
  todayFechaInput,
  type AccionParada,
  type TipoParadaForm,
} from '@/lib/grilla.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';

const GRILLA_BASE_STORAGE_KEY = 'lc-coord-grilla-base';

type AreaOption = { id: string; nombre: string };

type TipoParada = TipoParadaForm;

type FilaForm = {
  clientId: string;
  tipoParada: TipoParada;
  hora: string;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId: string;
  destinoId: string;
  accion: AccionParada;
  trasbordoHacia: string;
};

type GrillaListItem = {
  id: string;
  tipoItinerario: 'INGRESO' | 'SALIDA';
  fecha: string;
  nota: string | null;
  conCeladora: boolean;
  area: { id: string; nombre: string };
  transporte: { id: string; nombre: string; tipo: string };
  chofer: { id: string; username: string };
  celadora: { id: string; username: string } | null;
  filas: {
    id: string;
    hora: string;
    direccion: string;
    pasajeroNombre: string;
    pasajeroId?: string | null;
    destinoId?: string | null;
    accion: AccionParada;
    trasbordoHacia: string | null;
  }[];
};

const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `fila-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const emptyFila = (tipoItinerario: 'INGRESO' | 'SALIDA' = 'INGRESO'): FilaForm => ({
  clientId: newClientId(),
  tipoParada: 'pasajero',
  hora: '',
  direccion: '',
  pasajeroNombre: '',
  pasajeroId: '',
  destinoId: '',
  accion: accionPorTipoParada('pasajero', tipoItinerario),
  trasbordoHacia: '',
});

function filasEstanVacias(filas: FilaForm[]): boolean {
  if (filas.length === 0) return true;
  if (filas.length > 1) return false;
  const f = filas[0];
  return !f.hora.trim() && !f.direccion.trim() && !f.pasajeroNombre.trim();
}

export function CoordinadoraGrillasManager({
  modo = 'principal',
}: {
  modo?: 'principal' | 'historial';
}) {
  const popup = usePanelPopup();
  const esHistorial = modo === 'historial';
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areaId, setAreaId] = useState('');
  const [grillas, setGrillas] = useState<GrillaListItem[]>([]);
  const [options, setOptions] = useState<{
    transportes: {
      id: string;
      nombre: string;
      tipo: string;
      choferes: { id: string; username: string }[];
      celadoras: { id: string; username: string }[];
    }[];
    celadoras: { id: string; username: string }[];
    pasajeros: { id: string; nombre: string; direccion: string; destinoId: string | null }[];
    destinos: { id: string; nombre: string; domicilio: string }[];
    choferes: { id: string; username: string; transporteId: string | null }[];
  } | null>(null);

  const [form, setForm] = useState({
    tipoItinerario: 'INGRESO' as 'INGRESO' | 'SALIDA',
    fecha: todayFechaInput(),
    nota: '',
    conCeladora: true,
    transporteId: '',
    choferId: '',
    celadoraId: '',
  });
  const [filas, setFilas] = useState<FilaForm[]>([emptyFila('INGRESO')]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const formSectionRef = useRef<HTMLElement | null>(null);
  const filasRef = useRef(filas);
  const skipChoferSyncRef = useRef(false);
  const allowFilaDragRef = useRef(false);

  useEffect(() => {
    filasRef.current = filas;
  }, [filas]);

  const loadAreas = useCallback(async () => {
    const response = await fetch('/api/coord/areas');
    const body = await response.json();
    if (!response.ok) return;
    const list = (body.data as { id: string; nombre: string }[]).map((a) => ({
      id: a.id,
      nombre: a.nombre,
    }));
    setAreas(list);
    setAreaId((current) => current || list[0]?.id || '');
  }, []);

  const loadGrillas = useCallback(async (selectedArea: string) => {
    const url = selectedArea
      ? `/api/coord/grillas?areaId=${selectedArea}`
      : '/api/coord/grillas';
    const response = await fetch(url);
    const body = await response.json();
    if (!response.ok) {
      popup.error(body.message ?? 'No se pudieron cargar las grillas.');
      return;
    }
    setGrillas(body.data as GrillaListItem[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
  }, []);

  const loadOptions = useCallback(async (selectedArea: string) => {
    if (!selectedArea) {
      setOptions(null);
      return;
    }
    const response = await fetch(`/api/coord/grillas/options?areaId=${selectedArea}`);
    const body = await response.json();
    if (!response.ok) {
      popup.error(body.message ?? 'No se pudieron cargar opciones.');
      return;
    }
    setOptions(body.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
  }, []);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  useEffect(() => {
    if (!areaId) return;
    void loadGrillas(areaId);
    if (!esHistorial) void loadOptions(areaId);
  }, [areaId, esHistorial, loadGrillas, loadOptions]);

  const selectedTransporte = useMemo(
    () => options?.transportes.find((t) => t.id === form.transporteId) ?? null,
    [options, form.transporteId],
  );

  useEffect(() => {
    if (!selectedTransporte) return;
    if (skipChoferSyncRef.current) {
      skipChoferSyncRef.current = false;
      return;
    }
    const preferredChofer =
      selectedTransporte.choferes[0]?.id ||
      options?.choferes.find((c) => c.transporteId === selectedTransporte.id)?.id ||
      '';
    const preferredCeladora = selectedTransporte.celadoras[0]?.id || '';
    setForm((prev) => ({
      ...prev,
      choferId: preferredChofer || prev.choferId,
      celadoraId: preferredCeladora || prev.celadoraId,
    }));
  }, [selectedTransporte, options]);

  const applyGrillaBase = useCallback(
    (grilla: GrillaListItem, sourceLabel?: string) => {
      if (esHistorial) {
        try {
          sessionStorage.setItem(GRILLA_BASE_STORAGE_KEY, JSON.stringify(grilla));
          popup.success(
            sourceLabel ??
              `Base lista desde ${formatFechaGrilla(grilla.fecha)}. Abrí la pestaña Grillas para revisarla y guardar.`,
          );
        } catch {
          popup.error('No se pudo guardar la base. Probá de nuevo desde la pestaña Grillas.');
        }
        return;
      }

      skipChoferSyncRef.current = true;
      setForm({
        tipoItinerario: grilla.tipoItinerario,
        fecha: todayFechaInput(),
        nota: grilla.nota ?? '',
        conCeladora: grilla.conCeladora,
        transporteId: grilla.transporte.id,
        choferId: grilla.chofer.id,
        celadoraId: grilla.celadora?.id ?? '',
      });
      setFilas(
        grilla.filas.length > 0
          ? grilla.filas.map((f) => ({ ...mapGrillaFilaToForm(f), clientId: newClientId() }))
          : [emptyFila(grilla.tipoItinerario)],
      );
      popup.success(
        sourceLabel ??
          `Formulario cargado desde la grilla del ${formatFechaGrilla(grilla.fecha)}. Revisá y guardá.`,
      );
      requestAnimationFrame(() => {
        formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
    [esHistorial],
  );

  useEffect(() => {
    if (esHistorial) return;
    try {
      const raw = sessionStorage.getItem(GRILLA_BASE_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(GRILLA_BASE_STORAGE_KEY);
      const grilla = JSON.parse(raw) as GrillaListItem;
      applyGrillaBase(
        grilla,
        `Formulario cargado desde el historial (${formatFechaGrilla(grilla.fecha)}). Revisá y guardá.`,
      );
      if (grilla.area?.id) setAreaId(grilla.area.id);
    } catch {
      sessionStorage.removeItem(GRILLA_BASE_STORAGE_KEY);
    }
  }, [esHistorial, applyGrillaBase]);

  const grillasVisibles = useMemo(() => {
    if (esHistorial) return grillas;
    const hoy = todayFechaInput();
    return grillas.filter((g) => fechaGrillaKey(g.fecha) === hoy);
  }, [esHistorial, grillas]);

  const findUltimaLocal = useCallback(
    (
      transporteId: string,
      tipoItinerario: 'INGRESO' | 'SALIDA',
    ): GrillaListItem | null => {
      return (
        grillas.find(
          (g) => g.transporte.id === transporteId && g.tipoItinerario === tipoItinerario,
        ) ?? null
      );
    },
    [grillas],
  );

  const fetchUltima = useCallback(
    async (
      transporteId: string,
      tipoItinerario: 'INGRESO' | 'SALIDA',
      selectedArea: string,
    ): Promise<GrillaListItem | null> => {
      const local = findUltimaLocal(transporteId, tipoItinerario);
      if (local) return local;

      const params = new URLSearchParams({
        areaId: selectedArea,
        transporteId,
        tipoItinerario,
      });
      const response = await fetch(`/api/coord/grillas/ultima?${params}`);
      if (!response.ok) return null;
      const body = (await response.json()) as { data: GrillaListItem | null };
      return body.data;
    },
    [findUltimaLocal],
  );

  const tryPrecargaDesdeTransporte = useCallback(
    async (
      transporteId: string,
      tipoItinerario: 'INGRESO' | 'SALIDA',
      selectedArea: string,
    ) => {
      if (!transporteId || !selectedArea) return;

      const ultima = await fetchUltima(transporteId, tipoItinerario, selectedArea);
      if (!ultima) return;

      if (!filasEstanVacias(filasRef.current)) {
        const ok = await popup.confirm({
          message: `Hay una grilla anterior de este transporte (${formatFechaGrilla(ultima.fecha)}). ¿Cargar la última grilla de este transporte?`,
          confirmLabel: 'Cargar',
        });
        if (!ok) return;
      }

      applyGrillaBase(
        ultima,
        `Precargado desde la última grilla de este transporte (${formatFechaGrilla(ultima.fecha)}). Revisá y guardá.`,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
    [applyGrillaBase, fetchUltima],
  );

  const handleTransporteChange = (transporteId: string) => {
    setForm((p) => ({ ...p, transporteId }));
    if (transporteId && areaId) {
      void tryPrecargaDesdeTransporte(transporteId, form.tipoItinerario, areaId);
    }
  };

  const nombresPasajerosDeDestino = (destinoId: string): string[] => {
    if (!options?.pasajeros) return [];
    return options.pasajeros.filter((p) => p.destinoId === destinoId).map((p) => p.nombre);
  };

  const handleTipoChange = (tipoItinerario: 'INGRESO' | 'SALIDA') => {
    const prevTipo = form.tipoItinerario;
    setForm((p) => ({ ...p, tipoItinerario }));

    if (prevTipo !== tipoItinerario) {
      setFilas((prev) =>
        prev.map((fila) => {
          if (fila.tipoParada === 'trasbordo') return fila;
          const accion = invertirAccionSubeBaja(fila.accion);
          if (fila.tipoParada !== 'destino' || !fila.destinoId) {
            return { ...fila, accion };
          }
          const destino = options?.destinos.find((d) => d.id === fila.destinoId);
          return {
            ...fila,
            accion,
            pasajeroNombre: buildDetalleDestino({
              destinoNombre: destino?.nombre ?? fila.pasajeroNombre,
              accion,
              pasajeroNombres: nombresPasajerosDeDestino(fila.destinoId),
            }),
          };
        }),
      );
    }

    if (filasEstanVacias(filasRef.current) && form.transporteId && areaId) {
      void tryPrecargaDesdeTransporte(form.transporteId, tipoItinerario, areaId);
    }
  };

  const updateFila = (index: number, patch: Partial<FilaForm>) => {
    setFilas((prev) => prev.map((fila, i) => (i === index ? { ...fila, ...patch } : fila)));
  };

  const addFila = () => setFilas((prev) => [...prev, emptyFila(form.tipoItinerario)]);

  const removeFila = (index: number) => {
    setFilas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const moveFilaTo = (from: number, to: number) => {
    setFilas((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleFilaDragStart = (event: DragEvent<HTMLDivElement>, filaId: string) => {
    if (!allowFilaDragRef.current) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', filaId);
    setDraggingId(filaId);
    setDropTargetId(null);
  };

  const handleFilaDragEnd = () => {
    allowFilaDragRef.current = false;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleFilaDragOver = (event: DragEvent<HTMLDivElement>, filaId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggingId && draggingId !== filaId) {
      setDropTargetId(filaId);
    }
  };

  const handleFilaDrop = (event: DragEvent<HTMLDivElement>, toIndex: number) => {
    event.preventDefault();
    const fromId = event.dataTransfer.getData('text/plain');
    const fromIndex = filas.findIndex((f) => f.clientId === fromId);
    if (fromIndex >= 0) moveFilaTo(fromIndex, toIndex);
    allowFilaDragRef.current = false;
    setDraggingId(null);
    setDropTargetId(null);
  };

  const fillFromPasajero = (index: number, pasajeroId: string) => {
    const pasajero = options?.pasajeros.find((p) => p.id === pasajeroId);
    if (!pasajero) {
      updateFila(index, { pasajeroId: '', pasajeroNombre: '' });
      return;
    }
    updateFila(index, {
      pasajeroId,
      destinoId: '',
      pasajeroNombre: pasajero.nombre,
      direccion: pasajero.direccion,
      accion: accionPorTipoParada('pasajero', form.tipoItinerario),
    });
  };

  const fillFromDestino = (index: number, destinoId: string) => {
    const destino = options?.destinos.find((d) => d.id === destinoId);
    if (!destino) {
      updateFila(index, { destinoId: '', pasajeroNombre: '', direccion: '' });
      return;
    }
    const accion = accionPorTipoParada('destino', form.tipoItinerario);
    updateFila(index, {
      destinoId,
      pasajeroId: '',
      pasajeroNombre: buildDetalleDestino({
        destinoNombre: destino.nombre,
        accion,
        pasajeroNombres: nombresPasajerosDeDestino(destinoId),
      }),
      direccion: destino.domicilio,
      accion,
    });
  };

  const setTipoParada = (index: number, tipoParada: TipoParada) => {
    if (tipoParada === 'destino') {
      updateFila(index, {
        tipoParada,
        accion: accionPorTipoParada('destino', form.tipoItinerario),
        pasajeroId: '',
        trasbordoHacia: '',
      });
      return;
    }
    if (tipoParada === 'trasbordo') {
      updateFila(index, {
        tipoParada,
        accion: 'TRASBORDO',
        destinoId: '',
      });
      return;
    }
    updateFila(index, {
      tipoParada,
      accion: accionPorTipoParada('pasajero', form.tipoItinerario),
      destinoId: '',
      trasbordoHacia: '',
    });
  };

  const cargarSalidaDesdeIngreso = async () => {
    if (!areaId || !form.fecha) {
      popup.error('Seleccioná área y fecha primero.');
      return;
    }

    if (!filasEstanVacias(filas)) {
      const ok = await popup.confirm({
        message:
          'Esto va a reemplazar las filas actuales con los pasajeros que asistieron en el Ingreso de esa fecha. ¿Continuar?',
        confirmLabel: 'Cargar asistentes',
      });
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        areaId,
        fecha: form.fecha,
      });
      if (form.transporteId) params.set('transporteId', form.transporteId);

      const response = await fetch(`/api/coord/grillas/desde-ingreso?${params}`);
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo armar la Salida desde el Ingreso.'));
        return;
      }

      const body = (await response.json()) as {
        message?: string;
        data: {
          sugerido: {
            tipoItinerario: 'SALIDA';
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
      setForm({
        tipoItinerario: 'SALIDA',
        fecha: s.fecha,
        nota: s.nota ?? '',
        conCeladora: s.conCeladora,
        transporteId: s.transporteId,
        choferId: s.choferId,
        celadoraId: s.celadoraId ?? '',
      });
      setFilas(
        s.filas.length > 0
          ? s.filas.map((f) => ({
              clientId: newClientId(),
              tipoParada: f.tipoParada,
              hora: f.hora,
              direccion: f.direccion,
              pasajeroNombre: f.pasajeroNombre,
              pasajeroId: f.pasajeroId ?? '',
              destinoId: f.destinoId ?? '',
              accion: f.accion,
              trasbordoHacia: f.trasbordoHacia ?? '',
            }))
          : [emptyFila('SALIDA')],
      );
      popup.success(
        body.message ??
          'Salida armada desde los asistentes del Ingreso. Podés cambiar transporte, celadora y filas.',
      );
      requestAnimationFrame(() => {
        formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch {
      popup.error('Error de conexión al armar la Salida.');
    } finally {
      setSubmitting(false);
    }
  };

  const validateBeforeCreate = (): string | null => {
    const headerMissing = missingFieldsMessage(
      {
        areaId,
        tipoItinerario: form.tipoItinerario,
        fecha: form.fecha,
        transporteId: form.transporteId,
        choferId: form.choferId,
        ...(form.conCeladora ? { celadoraId: form.celadoraId } : {}),
      },
      {
        areaId: 'área',
        tipoItinerario: 'tipo de itinerario',
        fecha: 'fecha',
        transporteId: 'transporte',
        choferId: 'chofer',
        celadoraId: 'celadora',
      },
    );
    if (headerMissing) return headerMissing;

    if (filas.length === 0) {
      return 'Agregá al menos una fila al itinerario.';
    }

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const n = i + 1;
      const filaMissing = missingFieldsMessage(
        {
          hora: fila.hora,
          direccion: fila.direccion,
          pasajeroNombre: fila.pasajeroNombre,
          accion: fila.accion,
          ...(fila.accion === 'TRASBORDO' ? { trasbordoHacia: fila.trasbordoHacia } : {}),
        },
        {
          hora: `hora (fila ${n})`,
          direccion: `dirección (fila ${n})`,
          pasajeroNombre: `detalle/pasajero (fila ${n})`,
          accion: `acción (fila ${n})`,
          trasbordoHacia: `vehículo de trasbordo (fila ${n})`,
        },
      );
      if (filaMissing) return filaMissing;
    }

    return null;
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    const validationError = validateBeforeCreate();
    if (validationError) {
      popup.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/coord/grillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          areaId,
          celadoraId: form.conCeladora ? form.celadoraId : null,
          filas: filas.map((f) => ({
            hora: f.hora,
            direccion: f.direccion,
            pasajeroNombre: f.pasajeroNombre,
            pasajeroId: f.pasajeroId || null,
            destinoId: f.destinoId || null,
            accion: f.accion,
            trasbordoHacia: f.accion === 'TRASBORDO' ? f.trasbordoHacia || null : null,
          })),
        }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo crear la grilla.'));
        return;
      }
      const body = (await response.json()) as { message?: string; data: { id: string } };
      popup.success(body.message ?? 'Grilla creada.');
      setFilas([emptyFila(form.tipoItinerario)]);
      setForm((prev) => ({ ...prev, nota: '' }));
      await loadGrillas(areaId);
      setSelectedId(body.data.id);
    } catch {
      popup.error('Error de conexión. Revisá tu internet o que el servidor esté en marcha.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await popup.confirm({
      message: '¿Eliminar esta grilla?',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/coord/grillas/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar la grilla.'));
      return;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Grilla eliminada.');
    if (selectedId === id) setSelectedId(null);
    await loadGrillas(areaId);
  };

  const shareWhatsApp = (grilla: GrillaListItem) => {
    const titulo = buildGrillaTitulo({
      tipoItinerario: grilla.tipoItinerario,
      transporteNombre: grilla.transporte.nombre,
      fecha: grilla.fecha,
    });
    const text = buildGrillaWhatsAppText({
      titulo,
      tipoTransporte: grilla.transporte.tipo,
      choferNombre: grilla.chofer.username,
      celadoraNombre: grilla.celadora?.username ?? null,
      conCeladora: grilla.conCeladora,
      nota: grilla.nota,
      filas: grilla.filas,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const printGrilla = (grilla: GrillaListItem) => {
    const titulo = buildGrillaTitulo({
      tipoItinerario: grilla.tipoItinerario,
      transporteNombre: grilla.transporte.nombre,
      fecha: grilla.fecha,
    });
    const responsables = grilla.conCeladora
      ? `${grilla.chofer.username} + ${grilla.celadora?.username ?? '—'}`
      : `${grilla.chofer.username} (sin celadora)`;

    const rows = grilla.filas
      .map(
        (f) =>
          `<tr><td>${f.hora}</td><td>${f.direccion}</td><td>${formatAccionFila({
            accion: f.accion,
            pasajeroNombre: f.pasajeroNombre,
            trasbordoHacia: f.trasbordoHacia,
          })}</td></tr>`,
      )
      .join('');

    const html = `<!doctype html><html><head><title>${titulo}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 8px}
        .meta{margin-bottom:16px;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#111;color:#fff}
      </style></head><body>
      <h1>${titulo}</h1>
      <div class="meta">
        <div><strong>Área:</strong> ${grilla.area.nombre}</div>
        <div><strong>Tipo:</strong> ${grilla.transporte.tipo}</div>
        <div><strong>Responsables:</strong> ${responsables}</div>
        ${grilla.nota ? `<div><strong>Nota:</strong> ${grilla.nota}</div>` : ''}
      </div>
      <table><thead><tr><th>Hora</th><th>Parada / dirección</th><th>Acción</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;

    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const selected = grillas.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="coord-grillas">
      {popup.popupNode}

      {esHistorial ? (
        <section className="panel-card">
          <h2>Historial de grillas</h2>
          <p className="panel-card__desc">
            Todas las grillas del área seleccionada. Podés ver, compartir, imprimir o usar una como
            base (después abrí la pestaña Grillas para revisarla y guardar).
          </p>
          <div className="form-group" style={{ maxWidth: '20rem' }}>
            <label htmlFor="h-area">Área</label>
            <select
              id="h-area"
              value={areaId}
              onChange={(e) => {
                setSelectedId(null);
                setAreaId(e.target.value);
              }}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : (
      <section className="panel-card" ref={formSectionRef}>
        <h2>Crear grilla</h2>
        <p className="panel-card__desc">
          Armá el itinerario (ingreso/salida). Al cambiar Ingresos ↔ Salidas se invierten sube/baja.
          En Salidas podés cargar automáticamente a quienes asistieron en el Ingreso del día.
          Transporte y celadora quedan editables.
        </p>

        <form className="grilla-form" onSubmit={handleCreate}>
          <div className="grilla-form__grid">
            <div className="form-group">
              <label htmlFor="g-area">Área</label>
              <select id="g-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} required>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="g-tipo">Itinerario</label>
              <select
                id="g-tipo"
                value={form.tipoItinerario}
                onChange={(e) => handleTipoChange(e.target.value as 'INGRESO' | 'SALIDA')}
              >
                <option value="INGRESO">Ingresos</option>
                <option value="SALIDA">Salidas</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="g-fecha">Fecha</label>
              <input
                id="g-fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                required
              />
            </div>

            {form.tipoItinerario === 'SALIDA' && (
              <div className="form-group grilla-form__desde-ingreso">
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={submitting || !areaId || !form.fecha}
                  onClick={() => void cargarSalidaDesdeIngreso()}
                >
                  Cargar desde Ingresos (asistentes)
                </button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="g-tr">Transporte</label>
              <select
                id="g-tr"
                value={form.transporteId}
                onChange={(e) => handleTransporteChange(e.target.value)}
                required
              >
                <option value="">Seleccionar</option>
                {options?.transportes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} ({t.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="g-chofer">Chofer</label>
              <select
                id="g-chofer"
                value={form.choferId}
                onChange={(e) => setForm((p) => ({ ...p, choferId: e.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {(selectedTransporte?.choferes.length
                  ? selectedTransporte.choferes
                  : options?.choferes ?? []
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="g-con-cel">¿Con celadora?</label>
              <select
                id="g-con-cel"
                value={form.conCeladora ? 'si' : 'no'}
                onChange={(e) =>
                  setForm((p) => ({ ...p, conCeladora: e.target.value === 'si' }))
                }
              >
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>

            {form.conCeladora && (
              <div className="form-group">
                <label htmlFor="g-cel">Celadora</label>
                <select
                  id="g-cel"
                  value={form.celadoraId}
                  onChange={(e) => setForm((p) => ({ ...p, celadoraId: e.target.value }))}
                  required={form.conCeladora}
                >
                  <option value="">Seleccionar</option>
                  {(selectedTransporte?.celadoras.length
                    ? selectedTransporte.celadoras
                    : options?.celadoras ?? []
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group grilla-form__nota">
              <label htmlFor="g-nota">Nota (opcional)</label>
              <input
                id="g-nota"
                value={form.nota}
                onChange={(e) => setForm((p) => ({ ...p, nota: e.target.value }))}
                placeholder="Ej: rezar para que tengamos un día genial..."
              />
            </div>
          </div>

          <div className="grilla-filas">
            <div className="grilla-filas__head">
              <div>
                <h3>Paradas</h3>
                <p className="grilla-filas__hint">
                  Arrastrá el ícono ∷ para cambiar el orden de las filas.
                </p>
              </div>
              <button type="button" className="btn btn--outline btn--sm" onClick={addFila}>
                + Fila
              </button>
            </div>

            {filas.map((fila, index) => (
              <div
                key={fila.clientId}
                className={[
                  'grilla-fila',
                  'grilla-fila--rich',
                  draggingId === fila.clientId ? 'is-dragging' : '',
                  dropTargetId === fila.clientId ? 'is-drop-target' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={filas.length > 1}
                onDragStart={(e) => handleFilaDragStart(e, fila.clientId)}
                onDragEnd={handleFilaDragEnd}
                onDragOver={(e) => handleFilaDragOver(e, fila.clientId)}
                onDragLeave={() => {
                  if (dropTargetId === fila.clientId) setDropTargetId(null);
                }}
                onDrop={(e) => handleFilaDrop(e, index)}
              >
                <span
                  className="grilla-fila__handle"
                  role="button"
                  tabIndex={filas.length > 1 ? 0 : -1}
                  title="Arrastra para cambiar el orden"
                  aria-label={`Arrastrar fila ${index + 1} para cambiar el orden`}
                  aria-disabled={filas.length === 1}
                  onPointerDown={() => {
                    allowFilaDragRef.current = filas.length > 1;
                  }}
                >
                  <span className="grilla-fila__handle-icon" aria-hidden="true" />
                </span>

                <div className="form-group">
                  <label>Hora</label>
                  <input
                    type="time"
                    value={fila.hora}
                    onChange={(e) => updateFila(index, { hora: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de parada</label>
                  <select
                    value={fila.tipoParada}
                    onChange={(e) => setTipoParada(index, e.target.value as TipoParada)}
                  >
                    <option value="pasajero">Pasajero</option>
                    <option value="destino">Destino del área</option>
                    <option value="trasbordo">Trasbordo</option>
                  </select>
                </div>

                {fila.tipoParada === 'destino' ? (
                  <div className="form-group">
                    <label>Destino</label>
                    <select
                      value={fila.destinoId}
                      onChange={(e) => fillFromDestino(index, e.target.value)}
                      required
                    >
                      <option value="">Elegir destino</option>
                      {options?.destinos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Pasajero (catálogo)</label>
                    <select
                      value={fila.pasajeroId}
                      onChange={(e) => fillFromPasajero(index, e.target.value)}
                    >
                      <option value="">Manual / otro</option>
                      {options?.pasajeros.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Detalle en grilla</label>
                  <input
                    value={fila.pasajeroNombre}
                    onChange={(e) => updateFila(index, { pasajeroNombre: e.target.value })}
                    placeholder={
                      fila.tipoParada === 'destino'
                        ? 'Ej: pasajeros → Cetrinet'
                        : 'Nombre del pasajero'
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Dirección / lugar</label>
                  <input
                    value={fila.direccion}
                    onChange={(e) => updateFila(index, { direccion: e.target.value })}
                    list={`lugares-${index}`}
                    required
                  />
                  <datalist id={`lugares-${index}`}>
                    {options?.destinos.map((d) => (
                      <option key={d.id} value={d.domicilio}>
                        {d.nombre}
                      </option>
                    ))}
                    {options?.pasajeros.map((p) => (
                      <option key={p.id} value={p.direccion}>
                        {p.nombre}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Acción</label>
                  <select
                    value={fila.accion}
                    onChange={(e) =>
                      updateFila(index, { accion: e.target.value as AccionParada })
                    }
                  >
                    <option value="SUBE">sube</option>
                    <option value="BAJA">baja</option>
                    <option value="TRASBORDO">trasbordo</option>
                  </select>
                </div>

                {fila.accion === 'TRASBORDO' && (
                  <div className="form-group">
                    <label>Trasbordo hacia</label>
                    <select
                      value={fila.trasbordoHacia}
                      onChange={(e) => updateFila(index, { trasbordoHacia: e.target.value })}
                      required
                    >
                      <option value="">Elegir vehículo</option>
                      {options?.transportes
                        .filter((t) => t.id !== form.transporteId)
                        .map((t) => (
                          <option key={t.id} value={`${t.nombre} (${t.tipo})`}>
                            {t.nombre} ({t.tipo})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="form-group grilla-fila__acciones-wrap">
                  <label className="grilla-fila__acciones-label">&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => removeFila(index)}
                    disabled={filas.length === 1}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Guardando...' : 'Crear grilla'}
          </button>
        </form>
      </section>
      )}

      <section className="panel-card">
        <h2>{esHistorial ? 'Historial del área' : 'Grillas de hoy'}</h2>
        <p className="panel-card__desc">
          {esHistorial
            ? 'Listado completo de grillas de esta área.'
            : 'Solo las grillas del día de hoy. El resto está en Historial.'}
        </p>
        {grillasVisibles.length === 0 ? (
          <p className="panel-card__desc">
            {esHistorial
              ? 'Todavía no hay grillas en esta área.'
              : 'No hay grillas creadas para hoy en esta área.'}
          </p>
        ) : (
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Itinerario</th>
                  <th>Transporte</th>
                  <th>Responsables</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grillasVisibles.map((g) => (
                  <tr key={g.id} className={selectedId === g.id ? 'is-selected' : ''}>
                    <td>{formatFechaGrilla(g.fecha)}</td>
                    <td>{g.tipoItinerario === 'INGRESO' ? 'Ingresos' : 'Salidas'}</td>
                    <td>
                      {g.transporte.nombre}
                      <br />
                      <small>{g.transporte.tipo}</small>
                    </td>
                    <td>
                      {g.chofer.username}
                      {g.conCeladora ? ` + ${g.celadora?.username ?? '—'}` : ' (sin celadora)'}
                    </td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() =>
                          setSelectedId((current) => (current === g.id ? null : g.id))
                        }
                        aria-expanded={selectedId === g.id}
                      >
                        {selectedId === g.id ? 'Ocultar' : 'Ver'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => applyGrillaBase(g)}
                      >
                        Usar como base
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => shareWhatsApp(g)}
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => printGrilla(g)}
                      >
                        Imprimir
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => void handleDelete(g.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="panel-card grilla-preview">
          <h2>
            {buildGrillaTitulo({
              tipoItinerario: selected.tipoItinerario,
              transporteNombre: selected.transporte.nombre,
              fecha: selected.fecha,
            })}
          </h2>
          <p className="panel-card__desc">
            Responsables:{' '}
            {selected.conCeladora
              ? `${selected.chofer.username} + ${selected.celadora?.username ?? '—'}`
              : `${selected.chofer.username} (sin celadora)`}{' '}
            · Tipo: {selected.transporte.tipo}
          </p>
          {selected.nota && <p className="grilla-preview__nota">{selected.nota}</p>}
          <div className="admin-users__table-wrap">
            <table className="admin-users__table grilla-preview__table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Parada / dirección</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {selected.filas.map((f) => (
                  <tr key={f.id}>
                    <td>{f.hora}</td>
                    <td>{f.direccion}</td>
                    <td>
                      {formatAccionFila({
                        accion: f.accion,
                        pasajeroNombre: f.pasajeroNombre,
                        trasbordoHacia: f.trasbordoHacia,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => applyGrillaBase(selected)}
            >
              Usar como base
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
