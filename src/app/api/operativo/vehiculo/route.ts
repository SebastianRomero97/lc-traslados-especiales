import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';

/** Vehículo asignado al chofer + sus novedades recientes. */
export async function GET() {
  const auth = await requireOperativoApi(['CHOFER']);
  if ('error' in auth) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      transporteId: true,
      transporte: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          capacidad: true,
          active: true,
        },
      },
    },
  });

  if (!user?.transporte) {
    return NextResponse.json({
      data: { transporte: null, novedades: [] },
    });
  }

  const novedades = await prisma.novedadVehiculo.findMany({
    where: {
      transporteId: user.transporte.id,
      reportadoPorId: auth.user.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      mensaje: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: {
      transporte: user.transporte,
      novedades,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireOperativoApi(['CHOFER']);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as { mensaje?: string };
    const mensaje = body.mensaje?.trim() ?? '';
    if (mensaje.length < 5) {
      return NextResponse.json(
        { message: 'Escribí la novedad (mínimo 5 caracteres).' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { transporteId: true },
    });

    if (!user?.transporteId) {
      return NextResponse.json(
        { message: 'No tenés un vehículo asignado. Pedile al Admin que te asigne uno.' },
        { status: 400 },
      );
    }

    const novedad = await prisma.novedadVehiculo.create({
      data: {
        mensaje,
        transporteId: user.transporteId,
        reportadoPorId: auth.user.id,
      },
      select: {
        id: true,
        mensaje: true,
        createdAt: true,
        transporte: { select: { id: true, nombre: true, tipo: true } },
        reportadoPor: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json(
      { data: novedad, message: 'Novedad enviada. Admin y Administración podrán verla.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /operativo/vehiculo POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos guardar la novedad.') },
      { status: 500 },
    );
  }
}
