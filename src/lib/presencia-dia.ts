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
 * Lista unificada de presencia del día.
 * - Solo pasajeros con asistencia de celadora en grillas de ingreso (no destinos).
 * - Las asistencias / filas de salida no crean filas nuevas.
 * - "En grilla" = ese pasajero ya está en alguna salida del día.
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
    pasajeroId: string;
    pasajeroNombre: string;
    viajo: boolean;
    zonas: Set<string>;
  };

  const byKey = new Map<string, Acc>();

  // Solo asistencia de ingresos (ciclo: celadora envía → presencia → armar salidas).
  for (const g of ingresos) {
    for (const a of g.asistencias) {
      const pasajeroId = a.pasajeroId?.trim();
      // Sin pasajeroId suele ser destino institucional (Completado/Observación).
      if (!pasajeroId) continue;
      const nombre = a.pasajeroNombre.trim() || 'Pasajero';
      const key = pasajeroKey(pasajeroId, nombre);
      let row = byKey.get(key);
      if (!row) {
        row = {
          pasajeroId,
          pasajeroNombre: nombre,
          viajo: a.estado === 'ASISTIO',
          zonas: new Set([g.area.nombre]),
        };
        byKey.set(key, row);
      } else {
        if (a.estado === 'ASISTIO') row.viajo = true;
        row.zonas.add(g.area.nombre);
        if (nombre && row.pasajeroNombre === 'Pasajero') {
          row.pasajeroNombre = nombre;
        }
      }
    }
  }

  const keysByPasajeroId = new Map<string, string[]>();
  const keysByNombre = new Map<string, string[]>();
  for (const [key, row] of byKey) {
    const idList = keysByPasajeroId.get(row.pasajeroId) ?? [];
    idList.push(key);
    keysByPasajeroId.set(row.pasajeroId, idList);
    const nk = row.pasajeroNombre.trim().toLowerCase();
    if (nk) {
      const nList = keysByNombre.get(nk) ?? [];
      nList.push(key);
      keysByNombre.set(nk, nList);
    }
  }

  const enGrillaByKey = new Map<
    string,
    { id: string; nombre: string; transporte: string }[]
  >();

  const markEnGrilla = (
    key: string,
    g: { id: string; nombre: string; transporte: { nombre: string } },
  ) => {
    if (!byKey.has(key)) return;
    const list = enGrillaByKey.get(key) ?? [];
    if (!list.some((x) => x.id === g.id)) {
      list.push({
        id: g.id,
        nombre: g.nombre,
        transporte: g.transporte.nombre,
      });
    }
    enGrillaByKey.set(key, list);
  };

  for (const g of salidas) {
    for (const f of g.filas) {
      const pasajeroId = f.pasajeroId?.trim();
      const nombre = f.pasajeroNombre.trim();
      if (!pasajeroId && !nombre) continue;

      if (pasajeroId) {
        for (const key of keysByPasajeroId.get(pasajeroId) ?? []) {
          markEnGrilla(key, g);
        }
      }
      if (nombre) {
        for (const key of keysByNombre.get(nombre.toLowerCase()) ?? []) {
          markEnGrilla(key, g);
        }
      }
      // Fallback por key canónica (por si el índice no alcanzó).
      if (pasajeroId) {
        markEnGrilla(pasajeroKey(pasajeroId, nombre || 'Pasajero'), g);
      }
    }
  }

  const reservas = await prisma.presenciaEnGrillaReserva.findMany({
    where: { fecha },
    select: {
      pasajeroId: true,
      pasajeroNombre: true,
      sourceKey: true,
    },
  });

  for (const r of reservas) {
    const pasajeroId = r.pasajeroId.trim();
    const nombre = r.pasajeroNombre.trim();
    const fakeG = {
      id: `reserva:${r.sourceKey}`,
      nombre: 'En armado',
      transporte: { nombre: 'En armado' },
    };
    for (const key of keysByPasajeroId.get(pasajeroId) ?? []) {
      markEnGrilla(key, fakeG);
    }
    if (nombre) {
      for (const key of keysByNombre.get(nombre.toLowerCase()) ?? []) {
        markEnGrilla(key, fakeG);
      }
    }
    markEnGrilla(pasajeroKey(pasajeroId, nombre || 'Pasajero'), fakeG);
  }

  const overrides = await prisma.presenciaDia.findMany({
    where: { fecha },
  });
  const overrideByKey = new Map<string, (typeof overrides)[number]>();
  for (const o of overrides) {
    const pid = o.pasajeroId?.trim();
    if (pid) {
      overrideByKey.set(pasajeroKey(pid, o.pasajeroNombre), o);
      for (const k of keysByPasajeroId.get(pid) ?? []) {
        overrideByKey.set(k, o);
      }
    } else {
      overrideByKey.set(pasajeroKey(null, o.pasajeroNombre), o);
    }
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
        viajoConLc: row.viajo,
        enGrilla: grillasSalida.length > 0,
        grillasSalida,
        zonas: [...row.zonas].sort((a, b) => a.localeCompare(b, 'es')),
      };
    })
    .sort((a, b) => a.pasajeroNombre.localeCompare(b.pasajeroNombre, 'es'));

  const resumen = { presente: 0, ausente: 0, retirado: 0, enGrilla: 0 };
  for (const i of items) {
    if (i.enGrilla) {
      resumen.enGrilla += 1;
      continue;
    }
    if (i.estado === 'PRESENTE') resumen.presente += 1;
    else if (i.estado === 'RETIRADO') resumen.retirado += 1;
    else resumen.ausente += 1;
  }

  return { fecha: fechaStr, items, resumen };
}

/** Mapa rápido pasajeroId → info para avisos / colores en armado. */
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
