import type { Prisma } from '@/generated/prisma/client';
import {
  formatConflictMessage,
  grupoDeTipo,
  tiposDeGrupo,
  type ResourceConflict,
  type TipoGrupoItinerario,
  type TipoItinerario,
} from '@/lib/grilla.utils';

type Db = {
  grilla: Prisma.TransactionClient['grilla'];
  grillaFila: Prisma.TransactionClient['grillaFila'];
};

type ConflictInput = {
  fecha: Date;
  tipoItinerario: TipoItinerario;
  areaId: string;
  areaNombre: string;
  excludeGrillaId?: string;
  transporteId: string;
  choferId: string;
  celadoraId?: string | null;
  pasajeroIds: string[];
};

export async function findResourceConflicts(
  db: Db,
  input: ConflictInput,
): Promise<ResourceConflict[]> {
  const grupo = grupoDeTipo(input.tipoItinerario);
  const tipos = tiposDeGrupo(grupo);
  const dayStart = new Date(input.fecha);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const others = await db.grilla.findMany({
    where: {
      fecha: { gte: dayStart, lt: dayEnd },
      tipoItinerario: { in: tipos },
      ...(input.excludeGrillaId ? { id: { not: input.excludeGrillaId } } : {}),
    },
    select: {
      id: true,
      nombre: true,
      areaId: true,
      area: { select: { id: true, nombre: true } },
      transporteId: true,
      transporte: { select: { id: true, nombre: true } },
      choferId: true,
      chofer: { select: { id: true, username: true, isPrestador: true } },
      celadoraId: true,
      celadora: { select: { id: true, username: true } },
      filas: {
        where: { pasajeroId: { not: null } },
        select: {
          pasajeroId: true,
          pasajeroNombre: true,
          pasajero: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  const conflicts: ResourceConflict[] = [];
  const seen = new Set<string>();

  const push = (c: ResourceConflict) => {
    const key = `${c.kind}:${c.resourceId}:${c.grillaId}`;
    if (seen.has(key)) return;
    seen.add(key);
    conflicts.push(c);
  };

  for (const g of others) {
    if (g.transporteId === input.transporteId) {
      push({
        kind: 'vehiculo',
        resourceId: g.transporteId,
        resourceLabel: g.transporte.nombre,
        areaId: g.area.id,
        areaNombre: g.area.nombre,
        grillaId: g.id,
        grillaNombre: g.nombre,
      });
    }
    if (g.choferId === input.choferId) {
      push({
        kind: g.chofer.isPrestador ? 'prestador' : 'chofer',
        resourceId: g.choferId,
        resourceLabel: g.chofer.username,
        areaId: g.area.id,
        areaNombre: g.area.nombre,
        grillaId: g.id,
        grillaNombre: g.nombre,
      });
    }
    if (input.celadoraId && g.celadoraId === input.celadoraId && g.celadora) {
      push({
        kind: 'celadora',
        resourceId: g.celadoraId,
        resourceLabel: g.celadora.username,
        areaId: g.area.id,
        areaNombre: g.area.nombre,
        grillaId: g.id,
        grillaNombre: g.nombre,
      });
    }
    for (const fila of g.filas) {
      if (!fila.pasajeroId || !input.pasajeroIds.includes(fila.pasajeroId)) continue;
      push({
        kind: 'pasajero',
        resourceId: fila.pasajeroId,
        resourceLabel: fila.pasajero?.nombre ?? fila.pasajeroNombre,
        areaId: g.area.id,
        areaNombre: g.area.nombre,
        grillaId: g.id,
        grillaNombre: g.nombre,
      });
    }
  }

  return conflicts;
}

/** Limpia celadoras y filas de pasajeros conflictivos (chofer/vehículo son obligatorios en la otra grilla). */
export async function applyForceReassign(db: Db, conflicts: ResourceConflict[]): Promise<void> {
  const byGrilla = new Map<string, ResourceConflict[]>();
  for (const c of conflicts) {
    const list = byGrilla.get(c.grillaId) ?? [];
    list.push(c);
    byGrilla.set(c.grillaId, list);
  }

  for (const [grillaId, list] of byGrilla) {
    const hasCeladora = list.some((c) => c.kind === 'celadora');
    const pasajeroIds = list.filter((c) => c.kind === 'pasajero').map((c) => c.resourceId);

    if (hasCeladora) {
      await db.grilla.update({
        where: { id: grillaId },
        data: { celadoraId: null, conCeladora: false, puntoEncuentroId: null },
      });
    }
    if (pasajeroIds.length > 0) {
      await db.grillaFila.deleteMany({
        where: { grillaId, pasajeroId: { in: pasajeroIds } },
      });
    }
  }
}

export function conflictsResponseBody(
  conflicts: ResourceConflict[],
  targetAreaNombre: string,
) {
  const first = conflicts[0];
  const message = first
    ? formatConflictMessage(first, targetAreaNombre)
    : 'Hay recursos ya asignados en otra grilla.';
  return {
    code: 'RESOURCE_CONFLICT' as const,
    message:
      conflicts.length > 1
        ? `${message} (y ${conflicts.length - 1} conflicto${conflicts.length > 2 ? 's' : ''} más)`
        : message,
    conflicts,
  };
}

export function parseFechaDay(fecha: string | Date): Date {
  if (fecha instanceof Date) {
    const d = new Date(fecha);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  return new Date(`${fecha.slice(0, 10)}T00:00:00.000Z`);
}

export function tipoGrupoWhere(
  tipoGrupo: TipoGrupoItinerario | undefined,
): { tipoItinerario?: { in: TipoItinerario[] } } {
  if (!tipoGrupo) return {};
  return { tipoItinerario: { in: tiposDeGrupo(tipoGrupo) } };
}
