export type EstadoPresencia = 'PRESENTE' | 'AUSENTE' | 'RETIRADO';

export const ESTADOS_PRESENCIA: {
  value: EstadoPresencia;
  label: string;
}[] = [
  { value: 'PRESENTE', label: 'Presente' },
  { value: 'AUSENTE', label: 'Ausente' },
  { value: 'RETIRADO', label: 'Retirado' },
];

export function labelEstadoPresencia(estado: EstadoPresencia | string): string {
  if (estado === 'PRESENTE') return 'Presente';
  if (estado === 'RETIRADO') return 'Retirado';
  return 'Ausente';
}

export function isEstadoPresencia(value: string): value is EstadoPresencia {
  return value === 'PRESENTE' || value === 'AUSENTE' || value === 'RETIRADO';
}

export type PresenciaDiaItem = {
  key: string;
  pasajeroId: string | null;
  pasajeroNombre: string;
  /** Estado editable (sin “En grilla”). */
  estado: EstadoPresencia;
  /** Default derivado de asistencia de celadora. */
  estadoDefault: EstadoPresencia;
  /** Si Administración guardó un override. */
  tieneOverride: boolean;
  /** Viajó con LC según celadora (alguna grilla de ingreso). */
  viajoConLc: boolean | null;
  /** Está en alguna grilla de salida del día. */
  enGrilla: boolean;
  grillasSalida: { id: string; nombre: string; transporte: string }[];
  zonas: string[];
};

export function mensajeAvisoPresenciaSalida(params: {
  estado: EstadoPresencia;
  enGrilla: boolean;
  pasajeroNombre: string;
}): string | null {
  const nombre = params.pasajeroNombre.trim() || 'Este pasajero';
  if (params.enGrilla) {
    return `${nombre} ya está en una grilla de salida del día. Podés agregarlo igual si hace falta.`;
  }
  if (params.estado === 'AUSENTE') {
    return `${nombre} figura como Ausente en presencia del día. Podés agregarlo igual si hace falta.`;
  }
  if (params.estado === 'RETIRADO') {
    return `${nombre} figura como Retirado (ya no estaría disponible para el retiro). Podés agregarlo igual si hace falta.`;
  }
  return null;
}
