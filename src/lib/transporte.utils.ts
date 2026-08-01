import { todayFechaInput } from '@/lib/grilla.utils';

/** Estado VTV calculado desde la fecha de vencimiento (día inclusive). */
export type EstadoVtv = 'vigente' | 'vencida' | 'sin_dato';

export function estadoVtvFromFecha(
  vtvVenceAt: Date | string | null | undefined,
  now = new Date(),
): EstadoVtv {
  if (!vtvVenceAt) return 'sin_dato';
  const raw =
    typeof vtvVenceAt === 'string'
      ? vtvVenceAt.slice(0, 10)
      : vtvVenceAt.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'sin_dato';
  const today = todayFechaInput(now);
  return raw >= today ? 'vigente' : 'vencida';
}

export function labelEstadoVtv(estado: EstadoVtv): string {
  switch (estado) {
    case 'vigente':
      return 'Vigente';
    case 'vencida':
      return 'Vencida';
    default:
      return 'Sin dato';
  }
}

export function labelEstadoNovedad(estado: string): string {
  if (estado === 'RESUELTO') return 'Resuelto';
  return 'Pendiente de revisión';
}

export function parseOptionalDateInput(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const key = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
