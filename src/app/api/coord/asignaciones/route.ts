import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Body = {
  areaId?: string;
  action?:
    | 'add_celadora'
    | 'remove_celadora'
    | 'add_transporte'
    | 'remove_transporte'
    | 'add_pasajero'
    | 'remove_pasajero'
    | 'set_transporte_celadora'
    | 'clear_transporte_celadora';
  userId?: string;
  transporteId?: string;
  pasajeroId?: string;
};

export async function POST(request: Request) {
  const auth = await requireCoordinadoraApi();
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
    console.error('[API /coord/asignaciones POST]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar la asignación.') }, { status: 500 });
  }
}
