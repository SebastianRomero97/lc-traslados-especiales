import type { Prisma } from '@/generated/prisma/client';
import {
  formatConflictMessage,
  grupoDeTipo,
  tiposDeGrupo,
  type ResourceConflict,
  type TipoGrupoItinerario,
  type TipoItinerario,
} from '@/lib/grilla.utils';
import { grillaBloqueadaOperativa, type EstadoGrilla } from '@/lib/grilla-estado';

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

const KINDS_NO_AUTO: ResourceConflict['kind'][] = ['vehiculo', 'chofer', 'prestador'];

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
      // Finalizadas liberan recursos: se puede armar otra grilla del mismo grupo ese día.
      estado: { not: 'FINALIZADA' },
      ...(input.excludeGrillaId ? { id: { not: input.excludeGrillaId } } : {}),
    },
    select: {
      id: true,
      nombre: true,
      estado: true,
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
        estado: g.estado as EstadoGrilla,
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
        estado: g.estado as EstadoGrilla,
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
        estado: g.estado as EstadoGrilla,
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
        estado: g.estado as EstadoGrilla,
      });
    }
  }

  return conflicts;
}

/** Conflictos que no se pueden resolver con force (bloqueo operativo o chofer/vehículo). */
export function conflictsNotAutoResolvable(conflicts: ResourceConflict[]): ResourceConflict[] {
  return conflicts.filter(
    (c) =>
      (c.estado != null && grillaBloqueadaOperativa(c.estado)) ||
      KINDS_NO_AUTO.includes(c.kind),
  );
}

/** Solo limpia celadora / filas de pasajeros en grillas no bloqueadas. */
export async function applyForceReassign(db: Db, conflicts: ResourceConflict[]): Promise<void> {
  const byGrilla = new Map<string, ResourceConflict[]>();
  for (const c of conflicts) {
    if (c.estado != null && grillaBloqueadaOperativa(c.estado)) continue;
    if (KINDS_NO_AUTO.includes(c.kind)) continue;
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
        data: { celadoraId: null, puntoEncuentroId: null },
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
  const blocked = conflictsNotAutoResolvable(conflicts);
  const first = blocked[0] ?? conflicts[0];
  let message = first
    ? formatConflictMessage(first, targetAreaNombre)
    : 'Hay recursos ya asignados en otra grilla.';

  if (blocked.some((c) => c.estado === 'EN_CURSO')) {
    message = `${message} Esa grilla ya está en curso y no se puede reasignar.`;
  } else if (blocked.some((c) => KINDS_NO_AUTO.includes(c.kind))) {
    message = `${message} Chofer/vehículo no se reasignan solos: editá o eliminá la otra grilla primero.`;
  }

  return {
    code: 'RESOURCE_CONFLICT' as const,
    message:
      conflicts.length > 1
        ? `${message} (y ${conflicts.length - 1} conflicto${conflicts.length > 2 ? 's' : ''} más)`
        : message,
    conflicts,
    canForce: blocked.length === 0,
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
