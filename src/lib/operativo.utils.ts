import type { AccionParada } from '@/lib/grilla.utils';

export type EstadoAsistencia = 'ASISTIO' | 'CANCELO' | 'NO_SE_PRESENTO';

export type TipoControlParada = 'pasajero' | 'destino';

export const ESTADO_ASISTENCIA_LABEL: Record<EstadoAsistencia, string> = {
  ASISTIO: 'Asistió',
  CANCELO: 'Canceló',
  NO_SE_PRESENTO: 'No se presentó',
};

/** Etiquetas para destinos institucionales (no son pasajeros). */
export const ESTADO_DESTINO_LABEL: Record<EstadoAsistencia, string> = {
  ASISTIO: 'Completado',
  CANCELO: 'Cancelado',
  NO_SE_PRESENTO: 'Sin llegada',
};

export function labelsParaControl(tipo: TipoControlParada): Record<EstadoAsistencia, string> {
  return tipo === 'destino' ? ESTADO_DESTINO_LABEL : ESTADO_ASISTENCIA_LABEL;
}

export type NivelCombustible = 'VACIO' | 'CUARTO' | 'MEDIO' | 'TRES_CUARTOS' | 'LLENO';

export const NIVELES_COMBUSTIBLE: { value: NivelCombustible; label: string; orden: number }[] = [
  { value: 'VACIO', label: 'Vacío', orden: 0 },
  { value: 'CUARTO', label: '1/4 de tanque', orden: 1 },
  { value: 'MEDIO', label: '1/2 tanque', orden: 2 },
  { value: 'TRES_CUARTOS', label: '3/4 de tanque', orden: 3 },
  { value: 'LLENO', label: 'Tanque lleno', orden: 4 },
];

export const NIVEL_COMBUSTIBLE_LABEL: Record<NivelCombustible, string> = {
  VACIO: 'Vacío',
  CUARTO: '1/4 de tanque',
  MEDIO: '1/2 tanque',
  TRES_CUARTOS: '3/4 de tanque',
  LLENO: 'Tanque lleno',
};

export function composeInformeChofer(params: {
  conCeladora: boolean;
  obsCeladora?: string | null;
  obsVehiculo?: string | null;
  combustible?: NivelCombustible | null;
}): string {
  const parts: string[] = [];
  if (params.conCeladora && params.obsCeladora?.trim()) {
    parts.push(`Celadora: ${params.obsCeladora.trim()}`);
  }
  if (params.obsVehiculo?.trim()) {
    parts.push(`Vehículo: ${params.obsVehiculo.trim()}`);
  }
  if (params.combustible) {
    parts.push(`Combustible: ${NIVEL_COMBUSTIBLE_LABEL[params.combustible]}`);
  }
  return parts.join('\n');
}

export function mapsUrl(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

export function wazeUrl(direccion: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(direccion)}&navigate=yes`;
}

export type ItemControlOperativo = {
  pasajeroNombre: string;
  pasajeroId: string | null;
  destinoId: string | null;
  tipo: TipoControlParada;
};

/**
 * Ítems a controlar en el recorrido:
 * - pasajeros (asistencia)
 * - destinos institucionales (llegada / completado)
 */
export function extractItemsParaControl(
  filas: {
    pasajeroNombre: string;
    pasajeroId?: string | null;
    accion: AccionParada | string;
    destinoId?: string | null;
  }[],
): ItemControlOperativo[] {
  const map = new Map<string, ItemControlOperativo>();

  for (const fila of filas) {
    const nombre = fila.pasajeroNombre.trim();
    if (!nombre) continue;

    const esDestino = Boolean(fila.destinoId) && !fila.pasajeroId;
    const tipo: TipoControlParada = esDestino ? 'destino' : 'pasajero';

    // Trasbordos sin pasajero concreto: omitir si no hay nombre útil
    if (!esDestino && !fila.pasajeroId && fila.accion === 'TRASBORDO' && !nombre) continue;

    const key = `${tipo}:${nombre.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        pasajeroNombre: nombre,
        pasajeroId: fila.pasajeroId ?? null,
        destinoId: fila.destinoId ?? null,
        tipo,
      });
    } else if (fila.pasajeroId && !map.get(key)?.pasajeroId) {
      map.set(key, {
        pasajeroNombre: nombre,
        pasajeroId: fila.pasajeroId,
        destinoId: fila.destinoId ?? null,
        tipo: 'pasajero',
      });
    }
  }

  return Array.from(map.values());
}

/** @deprecated usar extractItemsParaControl */
export function extractPasajerosParaAsistencia(
  filas: {
    pasajeroNombre: string;
    pasajeroId?: string | null;
    accion: AccionParada | string;
    destinoId?: string | null;
  }[],
): { pasajeroNombre: string; pasajeroId: string | null }[] {
  return extractItemsParaControl(filas)
    .filter((i) => i.tipo === 'pasajero')
    .map(({ pasajeroNombre, pasajeroId }) => ({ pasajeroNombre, pasajeroId }));
}

export function formatDuration(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  const mins = Math.round((b - a) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}
