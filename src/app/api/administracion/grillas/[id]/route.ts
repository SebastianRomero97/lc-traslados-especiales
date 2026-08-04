import { NextResponse } from 'next/server';
import { describeCaughtError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import {
  buildGrillaTitulo,
  buildGrillaWhatsAppText,
  isTipoItinerario,
  normalizeAccion,
  type GrillaFilaInput,
  type TipoItinerario,
} from '@/lib/grilla.utils';
import { filaCoordsData, syncCoordsToSources } from '@/lib/coords-sync';
import {
  applyForceReassign,
  conflictsNotAutoResolvable,
  conflictsResponseBody,
  findResourceConflicts,
  parseFechaDay,
} from '@/lib/grilla-conflict';
import {
  grillaBloqueadaOperativa,
  puedeEditarGrillaAdmin,
  puedeEditarGrillaAdministracion,
  type EstadoGrilla,
} from '@/lib/grilla-estado';
import { canApproveGrillas, hasRole } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const grillaInclude = {
  area: { select: { id: true, nombre: true } },
  transporte: { select: { id: true, nombre: true, tipo: true } },
  chofer: { select: { id: true, username: true } },
  celadora: { select: { id: true, username: true } },
  puntoEncuentro: {
    select: {
      id: true,
      nombre: true,
      direccion: true,
      frecuente: true,
      lat: true,
      lon: true,
      usarCoordsParaChofer: true,
    },
  },
  filas: {
    orderBy: { orden: 'asc' as const },
    include: {
      pasajero: { select: { id: true, nombre: true, direccion: true } },
    },
  },
  asistencias: {
    select: {
      pasajeroNombre: true,
      estado: true,
      motivoCancelacion: true,
      pasajeroId: true,
    },
  },
};

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const grilla = await prisma.grilla.findUnique({
    where: { id },
    include: {
      ...grillaInclude,
      cerradoPor: { select: { id: true, username: true } },
    },
  });

  if (!grilla) {
    return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
  }

  const titulo = buildGrillaTitulo({
    tipoItinerario: grilla.tipoItinerario,
    transporteNombre: grilla.transporte.nombre,
    fecha: grilla.fecha,
  });

  const whatsappText = buildGrillaWhatsAppText({
    titulo,
    tipoTransporte: grilla.transporte.tipo,
    choferNombre: grilla.chofer.username,
    celadoraNombre: grilla.celadora?.username ?? null,
    conCeladora: grilla.conCeladora,
    nota: grilla.nota,
    filas: grilla.filas.map((f) => ({
      hora: f.hora,
      direccion: f.direccion,
      pasajeroNombre: f.pasajeroNombre,
      accion: f.accion,
      trasbordoHacia: f.trasbordoHacia,
    })),
  });

  return NextResponse.json({ data: grilla, titulo, whatsappText });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.grilla.findUnique({
      where: { id },
      include: { area: { select: { id: true, nombre: true } } },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    const estadoActual = existing.estado as EstadoGrilla;
    if (grillaBloqueadaOperativa(estadoActual)) {
      return NextResponse.json(
        { message: 'Esta grilla está en curso o finalizada y no se puede editar.' },
        { status: 400 },
      );
    }

    const esAdmin = hasRole(auth.user, 'ADMIN');
    const puedeAprobar = canApproveGrillas(auth.user);
    const puedeEditar = esAdmin
      ? puedeEditarGrillaAdmin(estadoActual)
      : puedeEditarGrillaAdministracion(estadoActual);
    if (!puedeEditar) {
      return NextResponse.json(
        {
          message:
            estadoActual === 'APROBADA'
              ? 'Para editar una grilla lista, primero usá Editar (vuelve a borrador).'
              : 'Esta grilla no se puede editar en su estado actual.',
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      nombre?: string;
      nota?: string | null;
      tipoItinerario?: string;
      fecha?: string;
      transporteId?: string;
      choferId?: string;
      conCeladora?: boolean;
      celadoraId?: string | null;
      puntoEncuentroId?: string | null;
      salidaDeBase?: boolean;
      retornoABase?: boolean;
      filas?: GrillaFilaInput[];
      forceReassign?: boolean;
      /** Quien puede aprobar: tras guardar, deja la grilla lista para empezar. */
      aprobarDespues?: boolean;
      /** ISO de updatedAt al abrir el editor (locking optimista). */
      expectedUpdatedAt?: string | null;
    };

    const forceReassign = Boolean(body.forceReassign);

    if (!body.expectedUpdatedAt) {
      return NextResponse.json(
        {
          code: 'STALE_VERSION',
          message:
            'Falta la versión de la grilla. Cerrá y volvé a abrirla para guardar sin pisar cambios.',
        },
        { status: 409 },
      );
    }

    const expectedMs = Date.parse(body.expectedUpdatedAt);
    const currentMs = existing.updatedAt.getTime();
    if (!Number.isFinite(expectedMs) || expectedMs !== currentMs) {
      return NextResponse.json(
        {
          code: 'STALE_VERSION',
          message:
            'Otro usuario modificó esta grilla mientras la editabas. Cerrá y volvé a abrirla para no pisar cambios.',
        },
        { status: 409 },
      );
    }

    const conCeladora = body.conCeladora ?? existing.conCeladora;
    const celadoraId =
      body.celadoraId === undefined
        ? existing.celadoraId
        : body.celadoraId?.trim() || null;
    const puntoEncuentroId =
      body.puntoEncuentroId === undefined
        ? existing.puntoEncuentroId
        : body.puntoEncuentroId?.trim() || null;
    const transporteId =
      body.transporteId === undefined
        ? existing.transporteId
        : body.transporteId.trim();
    const choferId =
      body.choferId === undefined ? existing.choferId : body.choferId.trim();
    const tipoItinerarioRaw =
      body.tipoItinerario === undefined ? existing.tipoItinerario : body.tipoItinerario.trim();
    if (!isTipoItinerario(tipoItinerarioRaw)) {
      return NextResponse.json(
        { message: 'El tipo de itinerario no es válido.' },
        { status: 400 },
      );
    }
    const tipoItinerario = tipoItinerarioRaw as TipoItinerario;
    const fecha =
      body.fecha === undefined
        ? existing.fecha
        : parseFechaDay(body.fecha.trim());

    if (!transporteId) {
      return NextResponse.json({ message: 'Seleccioná un transporte.' }, { status: 400 });
    }
    if (!choferId) {
      return NextResponse.json({ message: 'Seleccioná un chofer.' }, { status: 400 });
    }
    if (body.fecha !== undefined && Number.isNaN(fecha.getTime())) {
      return NextResponse.json({ message: 'Fecha inválida.' }, { status: 400 });
    }
    if (conCeladora && !celadoraId) {
      return NextResponse.json(
        { message: 'Si el recorrido es con celadora, seleccioná una celadora.' },
        { status: 400 },
      );
    }

    if (body.transporteId !== undefined) {
      const transporte = await prisma.transporte.findUnique({ where: { id: transporteId } });
      if (!transporte) {
        return NextResponse.json({ message: 'El transporte seleccionado no existe.' }, { status: 400 });
      }
    }
    if (body.choferId !== undefined) {
      const chofer = await prisma.user.findUnique({ where: { id: choferId } });
      if (!chofer || !chofer.roles.includes('CHOFER')) {
        return NextResponse.json(
          { message: 'El chofer seleccionado no es válido.' },
          { status: 400 },
        );
      }
    }
    if (celadoraId && body.celadoraId !== undefined) {
      const celadora = await prisma.user.findUnique({ where: { id: celadoraId } });
      if (!celadora || !celadora.roles.includes('CELADORA')) {
        return NextResponse.json(
          { message: 'La celadora seleccionada no es válida.' },
          { status: 400 },
        );
      }
    }

    let pasajeroIds: string[] = [];
    if (body.filas) {
      pasajeroIds = body.filas
        .map((f) => f.pasajeroId?.trim())
        .filter((pid): pid is string => Boolean(pid));
    } else {
      const existingFilas = await prisma.grillaFila.findMany({
        where: { grillaId: id, pasajeroId: { not: null } },
        select: { pasajeroId: true },
      });
      pasajeroIds = existingFilas
        .map((f) => f.pasajeroId)
        .filter((pid): pid is string => Boolean(pid));
    }

    const conflicts = await findResourceConflicts(prisma, {
      fecha: parseFechaDay(fecha),
      tipoItinerario,
      areaId: existing.areaId,
      areaNombre: existing.area.nombre,
      excludeGrillaId: id,
      transporteId,
      choferId,
      celadoraId: conCeladora ? celadoraId : null,
      pasajeroIds,
    });

    if (conflicts.length > 0 && !forceReassign) {
      return NextResponse.json(conflictsResponseBody(conflicts, existing.area.nombre), {
        status: 409,
      });
    }

    if (conflicts.length > 0 && forceReassign) {
      const blocked = conflictsNotAutoResolvable(conflicts);
      if (blocked.length > 0) {
        return NextResponse.json(conflictsResponseBody(conflicts, existing.area.nombre), {
          status: 409,
        });
      }
    }

    const grilla = await prisma.$transaction(async (tx) => {
      if (conflicts.length > 0 && forceReassign) {
        await applyForceReassign(tx, conflicts);
      }
      if (body.filas) {
        if (body.filas.length === 0) {
          throw new Error('EMPTY_FILAS');
        }
        for (let i = 0; i < body.filas.length; i++) {
          const fila = body.filas[i];
          const n = i + 1;
          if (fila.destinoId && !fila.hora?.trim()) {
            throw new Error(`DESTINO_SIN_HORA:${n}`);
          }
          if (!fila.direccion?.trim() || !fila.pasajeroNombre?.trim() || !fila.accion) {
            throw new Error(`FILA_INCOMPLETA:${n}`);
          }
        }
        await tx.grillaFila.deleteMany({ where: { grillaId: id } });
        await tx.grillaFila.createMany({
          data: body.filas.map((fila, index) => ({
            grillaId: id,
            orden: index + 1,
            hora: fila.hora?.trim() || null,
            direccion: fila.direccion.trim(),
            pasajeroNombre: fila.pasajeroNombre.trim(),
            pasajeroId: fila.pasajeroId || null,
            destinoId: fila.destinoId || null,
            accion: normalizeAccion(fila.accion),
            trasbordoHacia:
              normalizeAccion(fila.accion) === 'TRASBORDO'
                ? fila.trasbordoHacia?.trim() || null
                : null,
            ...filaCoordsData(fila),
          })),
        });
        await syncCoordsToSources(tx, body.filas);
      }

      return tx.grilla.update({
        where: { id },
        data: {
          nombre: body.nombre === undefined ? undefined : body.nombre.trim() || existing.nombre,
          nota: body.nota === undefined ? undefined : body.nota?.trim() || null,
          tipoItinerario,
          fecha,
          transporteId,
          choferId,
          conCeladora,
          celadoraId: conCeladora ? celadoraId : null,
          puntoEncuentroId: conCeladora ? puntoEncuentroId : null,
          ...(body.salidaDeBase !== undefined ? { salidaDeBase: Boolean(body.salidaDeBase) } : {}),
          ...(body.retornoABase !== undefined ? { retornoABase: Boolean(body.retornoABase) } : {}),
          ...(puedeAprobar && body.aprobarDespues
            ? { estado: 'APROBADA' as const, notaRevision: null }
            : {}),
        },
        include: grillaInclude,
      });
    });

    return NextResponse.json({
      data: grilla,
      message:
        puedeAprobar && body.aprobarDespues
          ? 'Grilla guardada y aprobada. Lista para empezar.'
          : 'Grilla actualizada.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPTY_FILAS') {
      return NextResponse.json(
        { message: 'La grilla debe tener al menos una fila.' },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.startsWith('DESTINO_SIN_HORA:')) {
      const n = error.message.split(':')[1];
      return NextResponse.json(
        { message: `Indicá la hora del destino (fila ${n}).` },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.startsWith('FILA_INCOMPLETA:')) {
      const n = error.message.split(':')[1];
      return NextResponse.json(
        { message: `Completá dirección y detalle de la fila ${n}.` },
        { status: 400 },
      );
    }
    console.error('[API /administracion/grillas PATCH]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar la grilla.') }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  if (!hasRole(auth.user, 'ADMIN')) {
    return NextResponse.json(
      { message: 'Solo Admin puede eliminar grillas.' },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.grilla.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }
    if (existing.estado === 'EN_CURSO' || existing.estado === 'FINALIZADA') {
      return NextResponse.json(
        { message: 'No se puede eliminar una grilla en curso o finalizada.' },
        { status: 400 },
      );
    }

    await prisma.grilla.delete({ where: { id } });
    return NextResponse.json({ message: 'Grilla eliminada.' });
  } catch (error) {
    console.error('[API /administracion/grillas DELETE]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos eliminar la grilla.') }, { status: 500 });
  }
}
