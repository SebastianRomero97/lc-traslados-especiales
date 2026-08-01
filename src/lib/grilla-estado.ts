export type EstadoGrilla =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'OBSERVADA'
  | 'APROBADA'
  | 'EN_CURSO'
  | 'FINALIZADA';

export const ESTADOS_GRILLA: EstadoGrilla[] = [
  'BORRADOR',
  'EN_REVISION',
  'OBSERVADA',
  'APROBADA',
  'EN_CURSO',
  'FINALIZADA',
];

/** Visibles para celadora / chofer. */
export const ESTADOS_GRILLA_OPERATIVOS: EstadoGrilla[] = [
  'APROBADA',
  'EN_CURSO',
  'FINALIZADA',
];

export const ESTADO_GRILLA_LABEL: Record<EstadoGrilla, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  OBSERVADA: 'Observada',
  APROBADA: 'Lista para empezar',
  EN_CURSO: 'Iniciada',
  FINALIZADA: 'Finalizada',
};

/** Colores de chip / borde. */
export const ESTADO_GRILLA_COLOR: Record<EstadoGrilla, string> = {
  BORRADOR: '#6b7280',
  EN_REVISION: '#2563eb',
  OBSERVADA: '#ea580c',
  APROBADA: '#16a34a',
  EN_CURSO: '#002d72',
  FINALIZADA: '#4d7c5a',
};

export function isEstadoGrilla(value: string): value is EstadoGrilla {
  return (ESTADOS_GRILLA as string[]).includes(value);
}

export function normalizeEstadoGrilla(value: string | null | undefined): EstadoGrilla {
  const v = value ?? '';
  return isEstadoGrilla(v) ? v : 'BORRADOR';
}

/** Administración puede editar contenido. */
export function puedeEditarGrillaAdministracion(estado: EstadoGrilla): boolean {
  return estado === 'BORRADOR' || estado === 'OBSERVADA';
}

/** Admin puede editar contenido (revisión). */
export function puedeEditarGrillaAdmin(estado: EstadoGrilla): boolean {
  return estado === 'EN_REVISION' || estado === 'OBSERVADA' || estado === 'BORRADOR';
}

export function grillaBloqueadaOperativa(estado: EstadoGrilla): boolean {
  return estado === 'EN_CURSO' || estado === 'FINALIZADA';
}

/** Al pedir Editar desde Lista para empezar → vuelve a borrador. */
export function puedeVolverABorrador(estado: EstadoGrilla): boolean {
  return estado === 'APROBADA' || estado === 'EN_REVISION' || estado === 'OBSERVADA';
}

export type TipoCierreGrilla = 'NORMAL' | 'FORZADO_ADMIN' | 'INTERRUMPIDO';

export const TIPO_CIERRE_LABEL: Record<TipoCierreGrilla, string> = {
  NORMAL: 'Cierre normal (chofer)',
  FORZADO_ADMIN: 'Finalizado forzado (Admin)',
  INTERRUMPIDO: 'Recorrido interrumpido (Admin)',
};

export function labelTipoCierre(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  if (tipo === 'NORMAL' || tipo === 'FORZADO_ADMIN' || tipo === 'INTERRUMPIDO') {
    return TIPO_CIERRE_LABEL[tipo];
  }
  return null;
}

/** Admin puede cerrar forzado/interrumpido solo en curso. */
export function puedeCierreAdminEmergencia(estado: EstadoGrilla): boolean {
  return estado === 'EN_CURSO';
}
