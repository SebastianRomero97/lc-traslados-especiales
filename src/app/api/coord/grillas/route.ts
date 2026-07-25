import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';
import { buildGrillaTitulo, normalizeAccion, type GrillaFilaInput } from '@/lib/grilla.utils';

const grillaInclude = {
  area: { select: { id: true, nombre: true } },
  transporte: { select: { id: true, nombre: true, tipo: true } },
  chofer: { select: { id: true, username: true } },
  celadora: { select: { id: true, username: true } },
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

    const grillas = await prisma.grilla.findMany({
      where: areaId ? { areaId } : undefined,
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
      tipoItinerario?: 'INGRESO' | 'SALIDA';
      fecha?: string;
      nota?: string;
      conCeladora?: boolean;
      areaId?: string;
      transporteId?: string;
      choferId?: string;
      celadoraId?: string | null;
      filas?: GrillaFilaInput[];
    };

    const tipoItinerario = body.tipoItinerario;
    const fecha = body.fecha?.trim();
    const areaId = body.areaId?.trim();
    const transporteId = body.transporteId?.trim();
    const choferId = body.choferId?.trim();
    const conCeladora = body.conCeladora !== false;
    const celadoraId = body.celadoraId?.trim() || null;
    const filas = body.filas ?? [];

    const missing = missingFieldsMessage(
      {
        tipoItinerario,
        fecha,
        areaId,
        transporteId,
        choferId,
        ...(conCeladora ? { celadoraId } : {}),
      },
      {
        tipoItinerario: 'tipo de itinerario (Ingresos/Salidas)',
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

    if (filas.length === 0) {
      return NextResponse.json(
        { message: 'Agregá al menos una fila al itinerario (hora, dirección y acción).' },
        { status: 400 },
      );
    }

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const n = i + 1;
      const filaMissing = missingFieldsMessage(
        {
          hora: fila.hora,
          direccion: fila.direccion,
          pasajeroNombre: fila.pasajeroNombre,
          accion: fila.accion,
          ...(normalizeAccion(fila.accion) === 'TRASBORDO'
            ? { trasbordoHacia: fila.trasbordoHacia }
            : {}),
        },
        {
          hora: `hora (fila ${n})`,
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
    if (!chofer || chofer.role !== 'CHOFER') {
      return NextResponse.json(
        { message: 'El chofer seleccionado no es válido. Elegí un usuario con rol Chofer.' },
        { status: 400 },
      );
    }

    if (celadoraId) {
      const celadora = await prisma.user.findUnique({ where: { id: celadoraId } });
      if (!celadora || celadora.role !== 'CELADORA') {
        return NextResponse.json(
          { message: 'La celadora seleccionada no es válida.' },
          { status: 400 },
        );
      }
    }

    const grilla = await prisma.grilla.create({
      data: {
        tipoItinerario: tipoItinerario!,
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        nota: body.nota?.trim() || null,
        conCeladora,
        areaId: areaId!,
        transporteId: transporteId!,
        choferId: choferId!,
        celadoraId: conCeladora ? celadoraId : null,
        createdById: auth.user.id,
        filas: {
          create: filas.map((fila, index) => ({
            orden: index + 1,
            hora: fila.hora.trim(),
            direccion: fila.direccion.trim(),
            pasajeroNombre: fila.pasajeroNombre.trim(),
            pasajeroId: fila.pasajeroId || null,
            destinoId: fila.destinoId || null,
            accion: normalizeAccion(fila.accion),
            trasbordoHacia:
              normalizeAccion(fila.accion) === 'TRASBORDO'
                ? fila.trasbordoHacia?.trim() || null
                : null,
          })),
        },
      },
      include: grillaInclude,
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
