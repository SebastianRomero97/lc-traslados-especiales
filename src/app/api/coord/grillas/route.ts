import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';
import {
  buildGrillaTitulo,
  isTipoGrupoItinerario,
  isTipoItinerario,
  normalizeAccion,
  type GrillaFilaInput,
  type TipoItinerario,
} from '@/lib/grilla.utils';
import { filaCoordsData, syncCoordsToSources } from '@/lib/coords-sync';
import {
  applyForceReassign,
  conflictsResponseBody,
  findResourceConflicts,
  parseFechaDay,
  tipoGrupoWhere,
} from '@/lib/grilla-conflict';

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
};

export async function GET(request: Request) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId') ?? undefined;
    const from = searchParams.get('from')?.trim() || undefined;
    const to = searchParams.get('to')?.trim() || undefined;
    const tipoGrupoRaw = searchParams.get('tipoGrupo')?.trim() || undefined;
    const tipoGrupo =
      tipoGrupoRaw && isTipoGrupoItinerario(tipoGrupoRaw) ? tipoGrupoRaw : undefined;

    const fechaFilter =
      from || to
        ? {
            fecha: {
              ...(from ? { gte: parseFechaDay(from) } : {}),
              ...(to
                ? {
                    lt: (() => {
                      const end = parseFechaDay(to);
                      end.setUTCDate(end.getUTCDate() + 1);
                      return end;
                    })(),
                  }
                : {}),
            },
          }
        : {};

    const grillas = await prisma.grilla.findMany({
      where: {
        ...(areaId ? { areaId } : {}),
        ...fechaFilter,
        ...tipoGrupoWhere(tipoGrupo),
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      include: grillaInclude,
    });

    return NextResponse.json({ data: grillas });
  } catch (error) {
    console.error('[API /coord/grillas GET]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(
          error,
          'No se pudieron cargar las grillas. Probá recargar la página.',
        ),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      tipoItinerario?: string;
      fecha?: string;
      nota?: string;
      conCeladora?: boolean;
      areaId?: string;
      transporteId?: string;
      choferId?: string;
      celadoraId?: string | null;
      puntoEncuentroId?: string | null;
      filas?: GrillaFilaInput[];
      forceReassign?: boolean;
    };

    const nombre = body.nombre?.trim() || '';
    const tipoItinerario = body.tipoItinerario?.trim();
    const fecha = body.fecha?.trim();
    const areaId = body.areaId?.trim();
    const transporteId = body.transporteId?.trim();
    const choferId = body.choferId?.trim();
    const conCeladora = body.conCeladora !== false;
    const celadoraId = body.celadoraId?.trim() || null;
    const puntoEncuentroId = body.puntoEncuentroId?.trim() || null;
    const filas = body.filas ?? [];
    const forceReassign = Boolean(body.forceReassign);

    const missing = missingFieldsMessage(
      {
        nombre,
        tipoItinerario,
        fecha,
        areaId,
        transporteId,
        choferId,
        ...(conCeladora ? { celadoraId } : {}),
      },
      {
        nombre: 'nombre de la grilla',
        tipoItinerario: 'tipo de itinerario',
        fecha: 'fecha',
        areaId: 'área',
        transporteId: 'transporte',
        choferId: 'chofer',
        celadoraId: 'celadora',
      },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    if (!tipoItinerario || !isTipoItinerario(tipoItinerario)) {
      return NextResponse.json(
        { message: 'El tipo de itinerario no es válido.' },
        { status: 400 },
      );
    }

    if (filas.length === 0) {
      return NextResponse.json(
        { message: 'Agregá al menos una fila al itinerario (dirección y acción).' },
        { status: 400 },
      );
    }

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const n = i + 1;
      const esDestino = Boolean(fila.destinoId);
      const filaMissing = missingFieldsMessage(
        {
          ...(esDestino ? { hora: fila.hora } : {}),
          direccion: fila.direccion,
          pasajeroNombre: fila.pasajeroNombre,
          accion: fila.accion,
          ...(normalizeAccion(fila.accion) === 'TRASBORDO'
            ? { trasbordoHacia: fila.trasbordoHacia }
            : {}),
        },
        {
          hora: `hora del destino (fila ${n})`,
          direccion: `dirección (fila ${n})`,
          pasajeroNombre: `detalle/pasajero (fila ${n})`,
          accion: `acción (fila ${n})`,
          trasbordoHacia: `vehículo de trasbordo (fila ${n})`,
        },
      );
      if (filaMissing) {
        return NextResponse.json({ message: filaMissing }, { status: 400 });
      }
    }

    const [area, transporte, chofer] = await Promise.all([
      prisma.area.findUnique({ where: { id: areaId! } }),
      prisma.transporte.findUnique({ where: { id: transporteId! } }),
      prisma.user.findUnique({ where: { id: choferId! } }),
    ]);

    if (!area) {
      return NextResponse.json({ message: 'El área seleccionada no existe.' }, { status: 400 });
    }
    if (!transporte) {
      return NextResponse.json(
        { message: 'El transporte seleccionado no existe.' },
        { status: 400 },
      );
    }
    if (!chofer || !chofer.roles.includes('CHOFER')) {
      return NextResponse.json(
        { message: 'El chofer seleccionado no es válido. Elegí un usuario con rol Chofer.' },
        { status: 400 },
      );
    }

    if (celadoraId) {
      const celadora = await prisma.user.findUnique({ where: { id: celadoraId } });
      if (!celadora || !celadora.roles.includes('CELADORA')) {
        return NextResponse.json(
          { message: 'La celadora seleccionada no es válida.' },
          { status: 400 },
        );
      }
    }

    const fechaDay = parseFechaDay(fecha!);
    const pasajeroIds = filas
      .map((f) => f.pasajeroId?.trim())
      .filter((id): id is string => Boolean(id));

    const conflicts = await findResourceConflicts(prisma, {
      fecha: fechaDay,
      tipoItinerario: tipoItinerario as TipoItinerario,
      areaId: areaId!,
      areaNombre: area.nombre,
      transporteId: transporteId!,
      choferId: choferId!,
      celadoraId: conCeladora ? celadoraId : null,
      pasajeroIds,
    });

    if (conflicts.length > 0 && !forceReassign) {
      return NextResponse.json(conflictsResponseBody(conflicts, area.nombre), {
        status: 409,
      });
    }

    const grilla = await prisma.$transaction(async (tx) => {
      if (conflicts.length > 0 && forceReassign) {
        await applyForceReassign(tx, conflicts);
      }
      await syncCoordsToSources(tx, filas);
      return tx.grilla.create({
        data: {
          nombre,
          tipoItinerario: tipoItinerario!,
          fecha: fechaDay,
          nota: body.nota?.trim() || null,
          conCeladora,
          areaId: areaId!,
          transporteId: transporteId!,
          choferId: choferId!,
          celadoraId: conCeladora ? celadoraId : null,
          puntoEncuentroId: conCeladora ? puntoEncuentroId : null,
          createdById: auth.user.id,
          filas: {
            create: filas.map((fila, index) => ({
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
          },
        },
        include: grillaInclude,
      });
    });

    const titulo = buildGrillaTitulo({
      tipoItinerario: grilla.tipoItinerario,
      transporteNombre: grilla.transporte.nombre,
      fecha: grilla.fecha,
    });

    return NextResponse.json(
      { data: grilla, titulo, message: 'Grilla creada.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /coord/grillas POST]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(error, 'No pudimos crear la grilla.'),
      },
      { status: 500 },
    );
  }
}
