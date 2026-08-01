import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Body = {
  areaId?: string;
  action?:
    | 'add_celadora'
    | 'remove_celadora'
    | 'add_chofer'
    | 'remove_chofer'
    | 'add_transporte'
    | 'remove_transporte'
    | 'add_pasajero'
    | 'remove_pasajero'
    | 'set_pasajero_destino'
    | 'set_destino_area'
    | 'set_transporte_celadora'
    | 'clear_transporte_celadora';
  userId?: string;
  transporteId?: string;
  pasajeroId?: string;
  destinoId?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as Body;
    const areaId = body.areaId?.trim();
    const action = body.action;

    if (!areaId || !action) {
      return NextResponse.json({ message: 'Faltan areaId o action.' }, { status: 400 });
    }

    const area = await prisma.area.findUnique({ where: { id: areaId } });
    if (!area) {
      return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
    }

    switch (action) {
      case 'add_celadora': {
        const userId = body.userId?.trim();
        if (!userId) {
          return NextResponse.json({ message: 'Falta userId.' }, { status: 400 });
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.roles.includes('CELADORA')) {
          return NextResponse.json({ message: 'La celadora no es válida.' }, { status: 400 });
        }
        await prisma.areaCeladora.upsert({
          where: { areaId_userId: { areaId, userId } },
          update: {},
          create: { areaId, userId },
        });
        return NextResponse.json({ message: 'Celadora asignada al área.' });
      }

      case 'remove_celadora': {
        const userId = body.userId?.trim();
        if (!userId) {
          return NextResponse.json({ message: 'Falta userId.' }, { status: 400 });
        }
        await prisma.areaCeladora.deleteMany({ where: { areaId, userId } });
        return NextResponse.json({ message: 'Celadora removida del área.' });
      }

      case 'add_chofer': {
        const userId = body.userId?.trim();
        if (!userId) {
          return NextResponse.json({ message: 'Falta userId.' }, { status: 400 });
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.roles.includes('CHOFER')) {
          return NextResponse.json({ message: 'El chofer no es válido.' }, { status: 400 });
        }
        await prisma.areaChofer.upsert({
          where: { areaId_userId: { areaId, userId } },
          update: {},
          create: { areaId, userId },
        });
        return NextResponse.json({
          message: user.isPrestador ? 'Prestador asignado al área.' : 'Chofer asignado al área.',
        });
      }

      case 'remove_chofer': {
        const userId = body.userId?.trim();
        if (!userId) {
          return NextResponse.json({ message: 'Falta userId.' }, { status: 400 });
        }
        await prisma.areaChofer.deleteMany({ where: { areaId, userId } });
        return NextResponse.json({ message: 'Chofer removido del área.' });
      }

      case 'add_transporte': {
        const transporteId = body.transporteId?.trim();
        if (!transporteId) {
          return NextResponse.json({ message: 'Falta transporteId.' }, { status: 400 });
        }
        const transporte = await prisma.transporte.findUnique({ where: { id: transporteId } });
        if (!transporte || !transporte.active) {
          return NextResponse.json({ message: 'El transporte no es válido.' }, { status: 400 });
        }
        await prisma.areaTransporte.upsert({
          where: { areaId_transporteId: { areaId, transporteId } },
          update: {},
          create: { areaId, transporteId },
        });
        return NextResponse.json({ message: 'Transporte asignado al área.' });
      }

      case 'remove_transporte': {
        const transporteId = body.transporteId?.trim();
        if (!transporteId) {
          return NextResponse.json({ message: 'Falta transporteId.' }, { status: 400 });
        }
        await prisma.areaTransporte.deleteMany({ where: { areaId, transporteId } });
        return NextResponse.json({ message: 'Transporte removido del área.' });
      }

      case 'add_pasajero': {
        const pasajeroId = body.pasajeroId?.trim();
        if (!pasajeroId) {
          return NextResponse.json({ message: 'Falta pasajeroId.' }, { status: 400 });
        }
        const pasajero = await prisma.pasajero.findUnique({ where: { id: pasajeroId } });
        if (!pasajero || !pasajero.active) {
          return NextResponse.json({ message: 'El pasajero no es válido.' }, { status: 400 });
        }
        await prisma.areaPasajero.upsert({
          where: { areaId_pasajeroId: { areaId, pasajeroId } },
          update: {},
          create: { areaId, pasajeroId },
        });
        return NextResponse.json({ message: 'Pasajero asignado al área.' });
      }

      case 'remove_pasajero': {
        const pasajeroId = body.pasajeroId?.trim();
        if (!pasajeroId) {
          return NextResponse.json({ message: 'Falta pasajeroId.' }, { status: 400 });
        }
        await prisma.areaPasajero.deleteMany({ where: { areaId, pasajeroId } });
        return NextResponse.json({ message: 'Pasajero removido del área.' });
      }

      case 'set_pasajero_destino': {
        const pasajeroId = body.pasajeroId?.trim();
        if (!pasajeroId) {
          return NextResponse.json({ message: 'Falta pasajeroId.' }, { status: 400 });
        }

        const linked = await prisma.areaPasajero.findUnique({
          where: { areaId_pasajeroId: { areaId, pasajeroId } },
        });
        if (!linked) {
          return NextResponse.json(
            { message: 'El pasajero debe estar asignado al área primero.' },
            { status: 400 },
          );
        }

        const destinoId =
          typeof body.destinoId === 'string' && body.destinoId.trim()
            ? body.destinoId.trim()
            : null;

        if (!destinoId) {
          return NextResponse.json(
            { message: 'Indicá el destino a asignar o quitar.' },
            { status: 400 },
          );
        }

        const destino = await prisma.destino.findFirst({
          where: { id: destinoId, areaId, active: true },
        });
        if (!destino) {
          return NextResponse.json(
            { message: 'El destino no pertenece a esta área.' },
            { status: 400 },
          );
        }

        const existing = await prisma.areaPasajeroDestino.findUnique({
          where: {
            areaId_pasajeroId_destinoId: { areaId, pasajeroId, destinoId },
          },
        });

        if (existing) {
          await prisma.areaPasajeroDestino.delete({
            where: {
              areaId_pasajeroId_destinoId: { areaId, pasajeroId, destinoId },
            },
          });
          return NextResponse.json({ message: 'Destino quitado del pasajero.' });
        }

        await prisma.areaPasajeroDestino.create({
          data: { areaId, pasajeroId, destinoId },
        });
        return NextResponse.json({ message: 'Destino asignado al pasajero.' });
      }

      case 'set_destino_area': {
        const destinoId = typeof body.destinoId === 'string' ? body.destinoId.trim() : '';
        if (!destinoId) {
          return NextResponse.json({ message: 'Falta destinoId.' }, { status: 400 });
        }
        const destino = await prisma.destino.findUnique({ where: { id: destinoId } });
        if (!destino || !destino.active) {
          return NextResponse.json({ message: 'El destino no es válido.' }, { status: 400 });
        }
        if (destino.areaId === areaId) {
          return NextResponse.json({ message: 'El destino ya pertenece a esta área.' });
        }
        await prisma.destino.update({
          where: { id: destinoId },
          data: { areaId },
        });
        return NextResponse.json({ message: 'Destino movido al área.' });
      }

      case 'set_transporte_celadora': {
        const transporteId = body.transporteId?.trim();
        const userId = body.userId?.trim();
        if (!transporteId || !userId) {
          return NextResponse.json({ message: 'Faltan transporteId o userId.' }, { status: 400 });
        }

        const inArea = await prisma.areaTransporte.findUnique({
          where: { areaId_transporteId: { areaId, transporteId } },
        });
        if (!inArea) {
          return NextResponse.json(
            { message: 'El transporte debe estar asignado al área primero.' },
            { status: 400 },
          );
        }

        const celadoraInArea = await prisma.areaCeladora.findUnique({
          where: { areaId_userId: { areaId, userId } },
        });
        if (!celadoraInArea) {
          return NextResponse.json(
            { message: 'La celadora debe estar asignada al área primero.' },
            { status: 400 },
          );
        }

        await prisma.transporteCeladora.upsert({
          where: { transporteId_userId: { transporteId, userId } },
          update: {},
          create: { transporteId, userId },
        });
        return NextResponse.json({ message: 'Celadora asignada al transporte.' });
      }

      case 'clear_transporte_celadora': {
        const transporteId = body.transporteId?.trim();
        const userId = body.userId?.trim();
        if (!transporteId || !userId) {
          return NextResponse.json({ message: 'Faltan transporteId o userId.' }, { status: 400 });
        }
        await prisma.transporteCeladora.deleteMany({ where: { transporteId, userId } });
        return NextResponse.json({ message: 'Celadora removida del transporte.' });
      }

      default:
        return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API /administracion/asignaciones POST]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar la asignación.') }, { status: 500 });
  }
}
