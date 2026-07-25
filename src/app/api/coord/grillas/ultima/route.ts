import { NextResponse } from 'next/server';
import { describeCaughtError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';

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

/** Última grilla similar (área + transporte + tipo) para reutilizar como base */
export async function GET(request: Request) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId')?.trim();
    const transporteId = searchParams.get('transporteId')?.trim();
    const tipoItinerario = searchParams.get('tipoItinerario')?.trim();

    if (!areaId || !transporteId || !tipoItinerario) {
      return NextResponse.json(
        {
          message:
            'Indicá área, transporte y tipo de itinerario (INGRESO o SALIDA) para buscar la última grilla.',
        },
        { status: 400 },
      );
    }

    if (tipoItinerario !== 'INGRESO' && tipoItinerario !== 'SALIDA') {
      return NextResponse.json(
        { message: 'El tipo de itinerario debe ser INGRESO o SALIDA.' },
        { status: 400 },
      );
    }

    const grilla = await prisma.grilla.findFirst({
      where: { areaId, transporteId, tipoItinerario },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      include: grillaInclude,
    });

    return NextResponse.json({ data: grilla });
  } catch (error) {
    console.error('[API /coord/grillas/ultima GET]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(
          error,
          'No se pudo buscar la última grilla similar.',
        ),
      },
      { status: 500 },
    );
  }
}
