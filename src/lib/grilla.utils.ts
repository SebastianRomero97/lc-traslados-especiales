export type AccionParada = 'SUBE' | 'BAJA' | 'TRASBORDO';

export type TipoParadaForm = 'pasajero' | 'destino' | 'trasbordo';

export type GrillaFilaInput = {
  hora: string;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId?: string | null;
  destinoId?: string | null;
  accion: AccionParada;
  trasbordoHacia?: string | null;
};

export type GrillaFilaParaForm = {
  hora: string;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId?: string | null;
  destinoId?: string | null;
  accion: AccionParada | string;
  trasbordoHacia?: string | null;
};

export function formatFechaGrilla(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function todayFechaInput(): string {
  return new Date().toISOString().slice(0, 10);
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
  tipoItinerario: 'INGRESO' | 'SALIDA';
  transporteNombre: string;
  fecha: Date | string;
}): string {
  const tipo = params.tipoItinerario === 'INGRESO' ? 'INGRESOS' : 'SALIDAS';
  return `ITINERARIO: ${tipo} "${params.transporteNombre.toUpperCase()}" — ${formatFechaGrilla(params.fecha)}`;
}

export function formatAccionFila(params: {
  accion: string;
  pasajeroNombre: string;
  trasbordoHacia?: string | null;
}): string {
  const accion = params.accion.toLowerCase();
  if (params.accion === 'TRASBORDO') {
    const hacia = params.trasbordoHacia?.trim();
    return hacia
      ? `trasbordo ${params.pasajeroNombre} → ${hacia}`
      : `trasbordo ${params.pasajeroNombre}`;
  }
  return `${accion} ${params.pasajeroNombre}`;
}

export function normalizeAccion(accion: string): AccionParada {
  if (accion === 'BAJA') return 'BAJA';
  if (accion === 'TRASBORDO') return 'TRASBORDO';
  return 'SUBE';
}

/** Acción esperada según tipo de parada e itinerario (Ingresos vs Salidas). */
export function accionPorTipoParada(
  tipoParada: TipoParadaForm,
  tipoItinerario: 'INGRESO' | 'SALIDA',
): AccionParada {
  if (tipoParada === 'trasbordo') return 'TRASBORDO';
  // Ingresos: suben en domicilio, bajan en destino.
  // Salidas: suben en destino, bajan en domicilio.
  if (tipoParada === 'destino') {
    return tipoItinerario === 'INGRESO' ? 'BAJA' : 'SUBE';
  }
  return tipoItinerario === 'INGRESO' ? 'SUBE' : 'BAJA';
}

export function invertirAccionSubeBaja(accion: AccionParada): AccionParada {
  if (accion === 'SUBE') return 'BAJA';
  if (accion === 'BAJA') return 'SUBE';
  return accion;
}

/** Texto de detalle para fila de destino, con nombres si están disponibles. */
export function buildDetalleDestino(params: {
  destinoNombre: string;
  accion: AccionParada;
  pasajeroNombres?: string[];
}): string {
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
    hora: string;
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
        `${f.hora} | ${f.direccion} | ${formatAccionFila({
          accion: f.accion,
          pasajeroNombre: f.pasajeroNombre,
          trasbordoHacia: f.trasbordoHacia,
        })}`,
    ),
  ].filter((line) => line !== null);

  return lineas.join('\n');
}
