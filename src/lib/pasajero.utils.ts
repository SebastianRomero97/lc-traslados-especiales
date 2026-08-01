import {
  fechaGrillaKey,
  grupoDeTipo,
  type TipoGrupoItinerario,
} from '@/lib/grilla.utils';

/** Estados de asistencia en ficha. */
export type EstadoAsistenciaFicha = 'ASISTIO' | 'CANCELO';

export type AsistenciaEstadoCount = 'ASISTIO' | 'CANCELO';

export type ResumenAsistencias = {
  asistio: number;
  cancelo: number;
  total: number;
};

/** Edad en años cumplidos a partir de fecha de cumpleaños (UTC date). */
export function edadDesdeCumpleanos(
  fechaCumpleanos: Date | string | null | undefined,
  now = new Date(),
): number | null {
  if (!fechaCumpleanos) return null;
  const key =
    typeof fechaCumpleanos === 'string'
      ? fechaCumpleanos.slice(0, 10)
      : fechaCumpleanos.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month < m || (month === m && day < d)) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

export function normalizeEstadoAsistenciaFicha(
  estado: string,
): EstadoAsistenciaFicha {
  return estado === 'ASISTIO' ? 'ASISTIO' : 'CANCELO';
}

export function labelEstadoAsistenciaFicha(estado: string): string {
  return normalizeEstadoAsistenciaFicha(estado) === 'ASISTIO' ? 'Asistió' : 'Canceló';
}

export function resumenAsistenciasFromRows(
  rows: { estado: AsistenciaEstadoCount | string }[],
): ResumenAsistencias {
  let asistio = 0;
  let cancelo = 0;
  for (const row of rows) {
    if (row.estado === 'ASISTIO') asistio += 1;
    else cancelo += 1;
  }
  return { asistio, cancelo, total: asistio + cancelo };
}

export function labelEstadoAsistenciaResumen(counts: ResumenAsistencias): string {
  return `Asistió ${counts.asistio} · Canceló ${counts.cancelo}`;
}

export function dateToInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export type HistorialRegistroFicha = {
  id: string;
  estado: string;
  /** Observación de cancelación (campo DB motivoCancelacion). */
  observacion: string | null;
  grilla: {
    id: string;
    fecha: string;
    tipoItinerario: string;
    nota: string | null;
    area: string;
    transporte: string;
    tipoTransporte: string;
    responsables: string;
    filas: {
      id: string;
      hora: string | null;
      direccion: string;
      pasajeroNombre: string;
      pasajeroId: string | null;
      accion: string;
      trasbordoHacia: string | null;
    }[];
  };
};

export type HistorialCeldaFicha = {
  registroId: string;
  estado: EstadoAsistenciaFicha;
  observacion: string | null;
  tipoItinerario: string;
  grilla: HistorialRegistroFicha['grilla'];
};

export type HistorialDiaFicha = {
  fechaKey: string;
  fecha: string;
  ingreso: HistorialCeldaFicha[];
  salida: HistorialCeldaFicha[];
  adaptacion: HistorialCeldaFicha[];
  especial: HistorialCeldaFicha[];
};

const COLUMNA_POR_GRUPO: Record<
  TipoGrupoItinerario,
  keyof Pick<HistorialDiaFicha, 'ingreso' | 'salida' | 'adaptacion' | 'especial'>
> = {
  ingreso: 'ingreso',
  salida: 'salida',
  adaptacion: 'adaptacion',
  especial: 'especial',
};

/** Agrupa registros de asistencia por día y columna (Ingreso/Salida/Adaptación/Especial). */
export function agruparHistorialPorDia(
  registros: HistorialRegistroFicha[],
): HistorialDiaFicha[] {
  const map = new Map<string, HistorialDiaFicha>();

  for (const r of registros) {
    const fechaKey = fechaGrillaKey(r.grilla.fecha);
    let dia = map.get(fechaKey);
    if (!dia) {
      dia = {
        fechaKey,
        fecha: r.grilla.fecha,
        ingreso: [],
        salida: [],
        adaptacion: [],
        especial: [],
      };
      map.set(fechaKey, dia);
    }
    const col = COLUMNA_POR_GRUPO[grupoDeTipo(r.grilla.tipoItinerario)];
    dia[col].push({
      registroId: r.id,
      estado: normalizeEstadoAsistenciaFicha(r.estado),
      observacion: r.observacion,
      tipoItinerario: r.grilla.tipoItinerario,
      grilla: r.grilla,
    });
  }

  return [...map.values()].sort((a, b) => b.fechaKey.localeCompare(a.fechaKey));
}
