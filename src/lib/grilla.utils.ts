export type AccionParada = 'SUBE' | 'BAJA' | 'TRASBORDO' | 'SALIDA_BASE' | 'RETORNO_BASE';

export function isAccionBaseLc(accion: string): boolean {
  return accion === 'SALIDA_BASE' || accion === 'RETORNO_BASE';
}

export function labelAccionParada(accion: string): string {
  switch (normalizeAccion(accion)) {
    case 'BAJA':
      return 'Baja';
    case 'TRASBORDO':
      return 'Trasbordo';
    case 'SALIDA_BASE':
      return 'Salida de base';
    case 'RETORNO_BASE':
      return 'Retorno a base';
    default:
      return 'Sube';
  }
}

export type TipoParadaForm = 'pasajero' | 'destino' | 'trasbordo';

/** Tipos de itinerario de grilla (incluye Adaptación y Especial). */
export type TipoItinerario =
  | 'INGRESO'
  | 'SALIDA'
  | 'ADAPTACION_INGRESO'
  | 'ADAPTACION_SALIDA'
  | 'ESPECIAL'
  | 'ESPECIAL_INGRESO'
  | 'ESPECIAL_SALIDA';

export type ModalidadItinerario = 'NORMAL' | 'ADAPTACION' | 'ESPECIAL';
export type SentidoItinerario = 'INGRESO' | 'SALIDA';

export const TIPOS_ITINERARIO: TipoItinerario[] = [
  'INGRESO',
  'SALIDA',
  'ADAPTACION_INGRESO',
  'ADAPTACION_SALIDA',
  'ESPECIAL',
  'ESPECIAL_INGRESO',
  'ESPECIAL_SALIDA',
];

export function isTipoItinerario(value: string): value is TipoItinerario {
  return (TIPOS_ITINERARIO as string[]).includes(value);
}

/** Sentido operativo para sube/baja. ESPECIAL sin definir = Ingreso. */
export function sentidoItinerario(tipo: TipoItinerario | string): SentidoItinerario {
  if (
    tipo === 'SALIDA' ||
    tipo === 'ADAPTACION_SALIDA' ||
    tipo === 'ESPECIAL_SALIDA'
  ) {
    return 'SALIDA';
  }
  return 'INGRESO';
}

export function isSalidaItinerario(tipo: TipoItinerario | string): boolean {
  return sentidoItinerario(tipo) === 'SALIDA';
}

export function modalidadItinerario(tipo: TipoItinerario | string): ModalidadItinerario {
  if (tipo.startsWith('ADAPTACION')) return 'ADAPTACION';
  if (tipo.startsWith('ESPECIAL')) return 'ESPECIAL';
  return 'NORMAL';
}

export function labelTipoItinerario(tipo: TipoItinerario | string): string {
  switch (tipo) {
    case 'INGRESO':
      return 'Ingresos';
    case 'SALIDA':
      return 'Salidas';
    case 'ADAPTACION_INGRESO':
      return 'Adaptación — Ingreso';
    case 'ADAPTACION_SALIDA':
      return 'Adaptación — Salida';
    case 'ESPECIAL':
      return 'Especial';
    case 'ESPECIAL_INGRESO':
      return 'Especial — Ingreso';
    case 'ESPECIAL_SALIDA':
      return 'Especial — Salida';
    default:
      return tipo;
  }
}

/** Combina modalidad + sentido (opcional en Especial) al enum de grilla. */
export function buildTipoItinerario(
  modalidad: ModalidadItinerario,
  sentido: SentidoItinerario | '',
): TipoItinerario {
  if (modalidad === 'NORMAL') {
    return sentido === 'SALIDA' ? 'SALIDA' : 'INGRESO';
  }
  if (modalidad === 'ADAPTACION') {
    return sentido === 'SALIDA' ? 'ADAPTACION_SALIDA' : 'ADAPTACION_INGRESO';
  }
  if (sentido === 'SALIDA') return 'ESPECIAL_SALIDA';
  if (sentido === 'INGRESO') return 'ESPECIAL_INGRESO';
  return 'ESPECIAL';
}

export function splitTipoItinerario(tipo: TipoItinerario | string): {
  modalidad: ModalidadItinerario;
  sentido: SentidoItinerario | '';
} {
  const modalidad = modalidadItinerario(tipo);
  if (tipo === 'ESPECIAL') return { modalidad: 'ESPECIAL', sentido: '' };
  return { modalidad, sentido: sentidoItinerario(tipo) };
}

/** Tipos “de ingreso” para armar Salida desde asistentes. */
export function tiposIngresoParaSalida(tipoSalida: TipoItinerario): TipoItinerario[] {
  const modalidad = modalidadItinerario(tipoSalida);
  if (modalidad === 'ADAPTACION') {
    return ['ADAPTACION_INGRESO', 'INGRESO'];
  }
  if (modalidad === 'ESPECIAL') {
    return ['ESPECIAL_INGRESO', 'ESPECIAL', 'INGRESO'];
  }
  return ['INGRESO', 'ADAPTACION_INGRESO', 'ESPECIAL_INGRESO', 'ESPECIAL'];
}

export type GrillaFilaInput = {
  hora?: string | null;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId?: string | null;
  destinoId?: string | null;
  accion: AccionParada;
  trasbordoHacia?: string | null;
  lat?: number | null;
  lon?: number | null;
  usarCoordsParaChofer?: boolean | null;
};

export type GrillaFilaParaForm = {
  hora?: string | null;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId?: string | null;
  destinoId?: string | null;
  accion: AccionParada | string;
  trasbordoHacia?: string | null;
  lat?: number | null;
  lon?: number | null;
  usarCoordsParaChofer?: boolean | null;
};

export function formatFechaGrilla(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function todayFechaInput(now = new Date()): string {
  // Día civil de operación LC (no UTC).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Clave YYYY-MM-DD comparable con todayFechaInput / inputs date. */
export function fechaGrillaKey(fecha: Date | string): string {
  if (typeof fecha === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.slice(0, 10);
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return fecha.slice(0, 10);
  }
  return fecha.toISOString().slice(0, 10);
}

export function buildGrillaTitulo(params: {
  tipoItinerario: TipoItinerario | string;
  transporteNombre: string;
  fecha: Date | string;
}): string {
  const tipo = labelTipoItinerario(params.tipoItinerario).toUpperCase();
  return `ITINERARIO: ${tipo} "${params.transporteNombre.toUpperCase()}" — ${formatFechaGrilla(params.fecha)}`;
}

export function formatAccionFila(params: {
  accion: string;
  pasajeroNombre: string;
  trasbordoHacia?: string | null;
}): string {
  if (params.accion === 'TRASBORDO') {
    const hacia = params.trasbordoHacia?.trim();
    return hacia
      ? `trasbordo ${params.pasajeroNombre} → ${hacia}`
      : `trasbordo ${params.pasajeroNombre}`;
  }
  if (isAccionBaseLc(params.accion)) {
    return labelAccionParada(params.accion);
  }
  const accion = params.accion.toLowerCase();
  return `${accion} ${params.pasajeroNombre}`;
}

export function normalizeAccion(accion: string): AccionParada {
  if (accion === 'BAJA') return 'BAJA';
  if (accion === 'TRASBORDO') return 'TRASBORDO';
  if (accion === 'SALIDA_BASE') return 'SALIDA_BASE';
  if (accion === 'RETORNO_BASE') return 'RETORNO_BASE';
  return 'SUBE';
}

/** Acción esperada según tipo de parada e itinerario (Ingresos vs Salidas). */
export function accionPorTipoParada(
  tipoParada: TipoParadaForm,
  tipoItinerario: TipoItinerario | SentidoItinerario | string,
): AccionParada {
  if (tipoParada === 'trasbordo') return 'TRASBORDO';
  const sentido = sentidoItinerario(tipoItinerario);
  // Ingresos: suben en domicilio, bajan en destino.
  // Salidas: suben en destino, bajan en domicilio.
  if (tipoParada === 'destino') {
    return sentido === 'INGRESO' ? 'BAJA' : 'SUBE';
  }
  return sentido === 'INGRESO' ? 'SUBE' : 'BAJA';
}

/** Base LC: en Salidas suele salir de base; en Ingresos suele retornar. */
export function accionPorDestinoBaseLc(
  tipoItinerario: TipoItinerario | SentidoItinerario | string,
): AccionParada {
  return sentidoItinerario(tipoItinerario) === 'INGRESO' ? 'RETORNO_BASE' : 'SALIDA_BASE';
}

/** Migración suave: filas viejas Base LC con Sube/Baja → Salida/Retorno. */
export function coerceAccionDestinoBaseLc(
  accion: string,
  tipoItinerario?: TipoItinerario | SentidoItinerario | string,
): AccionParada {
  const a = normalizeAccion(accion);
  if (a === 'SALIDA_BASE' || a === 'RETORNO_BASE') return a;
  if (a === 'BAJA') return 'RETORNO_BASE';
  if (a === 'SUBE') return 'SALIDA_BASE';
  return tipoItinerario ? accionPorDestinoBaseLc(tipoItinerario) : 'SALIDA_BASE';
}

export function invertirAccionSubeBaja(accion: AccionParada): AccionParada {
  if (accion === 'SUBE') return 'BAJA';
  if (accion === 'BAJA') return 'SUBE';
  if (accion === 'SALIDA_BASE') return 'RETORNO_BASE';
  if (accion === 'RETORNO_BASE') return 'SALIDA_BASE';
  return accion;
}

/** Texto de detalle para fila de destino, con nombres si están disponibles. */
export function buildDetalleDestino(params: {
  destinoNombre: string;
  accion: AccionParada;
  pasajeroNombres?: string[];
}): string {
  if (isAccionBaseLc(params.accion)) {
    return labelAccionParada(params.accion);
  }
  const names = (params.pasajeroNombres ?? []).map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    return `pasajeros → ${params.destinoNombre}`;
  }
  const verbo = params.accion === 'SUBE' ? 'Suben' : 'Bajan';
  return `${verbo}: ${names.join(', ')}`;
}

export function inferTipoParada(fila: {
  accion: string;
  destinoId?: string | null;
  trasbordoHacia?: string | null;
}): TipoParadaForm {
  const accion = normalizeAccion(fila.accion);
  if (accion === 'TRASBORDO' || Boolean(fila.trasbordoHacia?.trim())) return 'trasbordo';
  if (fila.destinoId) return 'destino';
  return 'pasajero';
}

export function mapGrillaFilaToForm(fila: GrillaFilaParaForm): {
  tipoParada: TipoParadaForm;
  hora: string;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId: string;
  destinoId: string;
  accion: AccionParada;
  trasbordoHacia: string;
  lat: number | null;
  lon: number | null;
  usarCoordsParaChofer: boolean;
} {
  const accion = normalizeAccion(fila.accion);
  const tipoParada = inferTipoParada(fila);
  return {
    tipoParada,
    hora: fila.hora ?? '',
    direccion: fila.direccion ?? '',
    pasajeroNombre: fila.pasajeroNombre ?? '',
    pasajeroId: fila.pasajeroId ?? '',
    destinoId: fila.destinoId ?? '',
    accion,
    trasbordoHacia: fila.trasbordoHacia ?? '',
    lat: fila.lat ?? null,
    lon: fila.lon ?? null,
    usarCoordsParaChofer: Boolean(fila.usarCoordsParaChofer),
  };
}

export function buildGrillaWhatsAppText(params: {
  titulo: string;
  tipoTransporte: string;
  choferNombre: string;
  celadoraNombre: string | null;
  conCeladora: boolean;
  nota?: string | null;
  filas: {
    hora?: string | null;
    direccion: string;
    pasajeroNombre: string;
    accion: string;
    trasbordoHacia?: string | null;
  }[];
}): string {
  const responsables = params.conCeladora
    ? `${params.choferNombre} + ${params.celadoraNombre ?? 'Sin celadora'}`
    : `${params.choferNombre} (sin celadora)`;

  const lineas = [
    params.titulo,
    `Tipo: ${params.tipoTransporte}`,
    `Responsables: ${responsables}`,
    params.nota ? `Nota: ${params.nota}` : null,
    '',
    ...params.filas.map(
      (f) =>
        `${f.hora?.trim() || '—'} | ${f.direccion} | ${formatAccionFila({
          accion: f.accion,
          pasajeroNombre: f.pasajeroNombre,
          trasbordoHacia: f.trasbordoHacia,
        })}`,
    ),
  ].filter((line) => line !== null);

  return lineas.join('\n');
}

/** Grupo de filtro UI (Hoy / Semana / Mes). */
export type TipoGrupoItinerario = 'ingreso' | 'salida' | 'adaptacion' | 'especial';

export const TIPOS_GRUPO: TipoGrupoItinerario[] = [
  'ingreso',
  'salida',
  'adaptacion',
  'especial',
];

export const TIPO_GRUPO_LABEL: Record<TipoGrupoItinerario, string> = {
  ingreso: 'Ingreso',
  salida: 'Salida',
  adaptacion: 'Adaptación',
  especial: 'Especial',
};

/** Color sólido del chip / borde del contenedor. */
export const TIPO_GRUPO_COLOR: Record<TipoGrupoItinerario, string> = {
  ingreso: '#16a34a',
  salida: '#dc2626',
  adaptacion: '#2563eb',
  especial: '#7c3aed',
};

export function isTipoGrupoItinerario(value: string): value is TipoGrupoItinerario {
  return (TIPOS_GRUPO as string[]).includes(value);
}

export function tiposDeGrupo(grupo: TipoGrupoItinerario): TipoItinerario[] {
  switch (grupo) {
    case 'ingreso':
      return ['INGRESO'];
    case 'salida':
      return ['SALIDA'];
    case 'adaptacion':
      return ['ADAPTACION_INGRESO', 'ADAPTACION_SALIDA'];
    case 'especial':
      return ['ESPECIAL', 'ESPECIAL_INGRESO', 'ESPECIAL_SALIDA'];
  }
}

export function grupoDeTipo(tipo: TipoItinerario | string): TipoGrupoItinerario {
  if (tipo === 'SALIDA') return 'salida';
  if (tipo.startsWith('ADAPTACION')) return 'adaptacion';
  if (tipo.startsWith('ESPECIAL')) return 'especial';
  return 'ingreso';
}

/** Tipo concreto por defecto al crear desde un chip de grupo. */
export function tipoDefaultDeGrupo(grupo: TipoGrupoItinerario): TipoItinerario {
  switch (grupo) {
    case 'ingreso':
      return 'INGRESO';
    case 'salida':
      return 'SALIDA';
    case 'adaptacion':
      return 'ADAPTACION_INGRESO';
    case 'especial':
      return 'ESPECIAL';
  }
}

/** Lunes 00:00 UTC de la semana que contiene `ref` (YYYY-MM-DD o Date). */
export function mondayOfWeek(ref: Date | string): string {
  const key = typeof ref === 'string' ? ref.slice(0, 10) : ref.toISOString().slice(0, 10);
  const d = new Date(`${key}T12:00:00.000Z`);
  const day = d.getUTCDay(); // 0=dom … 1=lun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Lun–Vie (5 fechas YYYY-MM-DD) a partir del lunes de la semana. */
export function weekdaysMonFri(mondayKey: string): string[] {
  const base = new Date(`${mondayKey}T12:00:00.000Z`);
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function addDaysKey(fechaKey: string, days: number): string {
  const d = new Date(`${fechaKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shiftWeekMonday(mondayKey: string, weeks: number): string {
  return addDaysKey(mondayKey, weeks * 7);
}

export function monthStartKey(year: number, monthIndex0: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0');
  return `${year}-${m}-01`;
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function labelDiaCorto(fechaKey: string): string {
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const d = new Date(`${fechaKey}T12:00:00.000Z`);
  return names[d.getUTCDay()] ?? '';
}

export function labelMesAnio(year: number, monthIndex0: number): string {
  const names = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${names[monthIndex0] ?? ''} ${year}`;
}

export type ResourceConflictKind =
  | 'chofer'
  | 'prestador'
  | 'celadora'
  | 'vehiculo'
  | 'pasajero';

export type ResourceConflict = {
  kind: ResourceConflictKind;
  resourceId: string;
  resourceLabel: string;
  areaId: string;
  areaNombre: string;
  grillaId: string;
  grillaNombre: string;
  /** Estado de la grilla en conflicto (si se conoce). */
  estado?: import('@/lib/grilla-estado').EstadoGrilla;
};

export function labelConflictKind(kind: ResourceConflictKind): string {
  switch (kind) {
    case 'chofer':
      return 'chofer';
    case 'prestador':
      return 'prestador';
    case 'celadora':
      return 'celadora';
    case 'vehiculo':
      return 'vehículo';
    case 'pasajero':
      return 'pasajero';
  }
}

export function formatConflictMessage(
  conflict: ResourceConflict,
  targetAreaNombre: string,
): string {
  return `Este ${labelConflictKind(conflict.kind)} (${conflict.resourceLabel}) ya está asignado en ${conflict.areaNombre}. ¿Desea cambiarlo y asignarlo en ${targetAreaNombre}?`;
}

/** Parsea "HH:MM" a minutos desde medianoche. */
export function parseHoraMinutos(hora: string | null | undefined): number | null {
  const raw = hora?.trim() ?? '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export function formatHoraMinutos(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Sugiere horarios hacia atrás desde destinos con hora fija.
 * Solo completa filas sin hora; no pisa horarios ya cargados.
 */
export function sugerirHorariosHaciaAtras(
  filas: { hora?: string | null; destinoId?: string | null }[],
  minutosEntreParadas = 15,
): (string | null)[] {
  const gap = Math.max(1, minutosEntreParadas);
  const result: (string | null)[] = filas.map((f) => f.hora?.trim() || null);

  for (let i = 0; i < filas.length; i++) {
    if (!filas[i]?.destinoId) continue;
    const anchor = parseHoraMinutos(result[i]);
    if (anchor == null) continue;

    let cursor = anchor;
    for (let j = i - 1; j >= 0; j--) {
      if (filas[j]?.destinoId && result[j]) break;
      if (result[j]) continue;
      cursor -= gap;
      result[j] = formatHoraMinutos(cursor);
    }
  }

  return result;
}

