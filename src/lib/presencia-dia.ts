import { prisma } from '@/lib/prisma';
import { parseFechaDay } from '@/lib/grilla-conflict';
import { isSalidaItinerario, todayFechaInput } from '@/lib/grilla.utils';
import type { EstadoPresencia, PresenciaDiaItem } from '@/lib/presencia-dia.utils';

export type { EstadoPresencia, PresenciaDiaItem } from '@/lib/presencia-dia.utils';
export {
  ESTADOS_PRESENCIA,
  isEstadoPresencia,
  labelEstadoPresencia,
  mensajeAvisoPresenciaSalida,
} from '@/lib/presencia-dia.utils';

function pasajeroKey(pasajeroId: string | null | undefined, nombre: string): string {
  const id = pasajeroId?.trim();
  if (id) return `id:${id}`;
  return `nombre:${nombre.trim().toLowerCase()}`;
}

/**
 * Lista unificada de presencia del día (ingresos → default; override; en grilla salida).
 * Solo servidor (usa Prisma).
 */
export async function buildPresenciaDia(fechaInput?: string): Promise<{
  fecha: string;
  items: PresenciaDiaItem[];
  resumen: { presente: number; ausente: number; retirado: number; enGrilla: number };
}> {
  const fechaStr = (fechaInput?.trim() || todayFechaInput()).slice(0, 10);
  const fecha = parseFechaDay(fechaStr);

  const grillas = await prisma.grilla.findMany({
    where: { fecha },
    select: {
      id: true,
      nombre: true,
      tipoItinerario: true,
      area: { select: { nombre: true } },
      transporte: { select: { nombre: true } },
      filas: {
        select: {
          pasajeroId: true,
          pasajeroNombre: true,
          destinoId: true,
          accion: true,
        },
      },
      asistencias: {
        select: {
          pasajeroId: true,
          pasajeroNombre: true,
          estado: true,
        },
      },
    },
  });

  const ingresos = grillas.filter((g) => !isSalidaItinerario(g.tipoItinerario));
  const salidas = grillas.filter((g) => isSalidaItinerario(g.tipoItinerario));

  type Acc = {
    pasajeroId: string | null;
    pasajeroNombre: string;
    viajo: boolean;
    tieneAsistencia: boolean;
    zonas: Set<string>;
  };

  const byKey = new Map<string, Acc>();

  for (const g of ingresos) {
    for (const f of g.filas) {
      const nombre = f.pasajeroNombre.trim();
      if (!nombre) continue;
      const esDestino = Boolean(f.destinoId) && !f.pasajeroId;
      if (esDestino) continue;
      if (!f.pasajeroId && f.accion === 'TRASBORDO') continue;

      const key = pasajeroKey(f.pasajeroId, nombre);
      let row = byKey.get(key);
      if (!row) {
        row = {
          pasajeroId: f.pasajeroId ?? null,
          pasajeroNombre: nombre,
          viajo: false,
          tieneAsistencia: false,
          zonas: new Set(),
        };
        byKey.set(key, row);
      } else if (f.pasajeroId && !row.pasajeroId) {
        row.pasajeroId = f.pasajeroId;
      }
      row.zonas.add(g.area.nombre);
    }

    for (const a of g.asistencias) {
      const nombre = a.pasajeroNombre.trim();
      if (!nombre) continue;
      const key = pasajeroKey(a.pasajeroId, nombre);
      let row = byKey.get(key);
      if (!row) {
        row = {
          pasajeroId: a.pasajeroId ?? null,
          pasajeroNombre: nombre,
          viajo: a.estado === 'ASISTIO',
          tieneAsistencia: true,
          zonas: new Set([g.area.nombre]),
        };
        byKey.set(key, row);
      } else {
        if (a.pasajeroId && !row.pasajeroId) row.pasajeroId = a.pasajeroId;
        row.tieneAsistencia = true;
        if (a.estado === 'ASISTIO') row.viajo = true;
        row.zonas.add(g.area.nombre);
      }
    }
  }

  const enGrillaByKey = new Map<
    string,
    { id: string; nombre: string; transporte: string }[]
  >();
  for (const g of salidas) {
    for (const f of g.filas) {
      if (!f.pasajeroId && !f.pasajeroNombre.trim()) continue;
      if (f.destinoId && !f.pasajeroId) continue;
      const nombre = f.pasajeroNombre.trim();
      if (!nombre) continue;
      const key = pasajeroKey(f.pasajeroId, nombre);
      const list = enGrillaByKey.get(key) ?? [];
      if (!list.some((x) => x.id === g.id)) {
        list.push({
          id: g.id,
          nombre: g.nombre,
          transporte: g.transporte.nombre,
        });
      }
      enGrillaByKey.set(key, list);
      if (!byKey.has(key)) {
        byKey.set(key, {
          pasajeroId: f.pasajeroId ?? null,
          pasajeroNombre: nombre,
          viajo: false,
          tieneAsistencia: false,
          zonas: new Set([g.area.nombre]),
        });
      }
    }
  }

  const overrides = await prisma.presenciaDia.findMany({
    where: { fecha },
  });
  const overrideByKey = new Map<string, (typeof overrides)[number]>();
  for (const o of overrides) {
    overrideByKey.set(pasajeroKey(o.pasajeroId, o.pasajeroNombre), o);
  }

  const items: PresenciaDiaItem[] = [...byKey.entries()]
    .map(([key, row]) => {
      const estadoDefault: EstadoPresencia = row.viajo ? 'PRESENTE' : 'AUSENTE';
      const ov = overrideByKey.get(key);
      const estado: EstadoPresencia = ov?.estado ?? estadoDefault;
      const grillasSalida = enGrillaByKey.get(key) ?? [];
      return {
        key,
        pasajeroId: row.pasajeroId,
        pasajeroNombre: row.pasajeroNombre,
        estado,
        estadoDefault,
        tieneOverride: Boolean(ov),
        viajoConLc: row.tieneAsistencia ? row.viajo : null,
        enGrilla: grillasSalida.length > 0,
        grillasSalida,
        zonas: [...row.zonas].sort((a, b) => a.localeCompare(b, 'es')),
      };
    })
    .sort((a, b) => a.pasajeroNombre.localeCompare(b.pasajeroNombre, 'es'));

  const resumen = { presente: 0, ausente: 0, retirado: 0, enGrilla: 0 };
  for (const i of items) {
    if (i.enGrilla) resumen.enGrilla += 1;
    if (i.estado === 'PRESENTE') resumen.presente += 1;
    else if (i.estado === 'RETIRADO') resumen.retirado += 1;
    else resumen.ausente += 1;
  }

  return { fecha: fechaStr, items, resumen };
}

/** Mapa rápido pasajeroId → info para avisos en armado de salida. */
export async function presenciaMapForFecha(fechaInput: string): Promise<
  Record<
    string,
    {
      estado: EstadoPresencia;
      enGrilla: boolean;
      pasajeroNombre: string;
    }
  >
> {
  const { items } = await buildPresenciaDia(fechaInput);
  const map: Record<
    string,
    { estado: EstadoPresencia; enGrilla: boolean; pasajeroNombre: string }
  > = {};
  for (const i of items) {
    if (i.pasajeroId) {
      map[i.pasajeroId] = {
        estado: i.estado,
        enGrilla: i.enGrilla,
        pasajeroNombre: i.pasajeroNombre,
      };
    }
  }
  return map;
}
