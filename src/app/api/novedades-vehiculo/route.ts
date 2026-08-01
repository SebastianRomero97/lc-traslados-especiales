import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasAnyRole, hasRole } from '@/lib/roles';
import { describeCaughtError } from '@/lib/api-errors';

const novedadSelect = {
  id: true,
  mensaje: true,
  estado: true,
  detalleAdmin: true,
  createdAt: true,
  updatedAt: true,
  transporte: { select: { id: true, nombre: true, tipo: true } },
  reportadoPor: { select: { id: true, username: true } },
} as const;

/** Listado de novedades de vehículos para Admin y Coordinadora. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }
  if (!hasAnyRole(session, ['ADMIN', 'COORDINADORA'])) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
  }

  const novedades = await prisma.novedadVehiculo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: novedadSelect,
  });

  return NextResponse.json({ data: novedades });
}

/** Admin actualiza estado / detalle de una novedad. */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }
  if (!hasRole(session, 'ADMIN')) {
    return NextResponse.json({ message: 'Solo Admin puede gestionar novedades.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      estado?: string;
      detalleAdmin?: string | null;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ message: 'Falta el id de la novedad.' }, { status: 400 });
    }

    const existing = await prisma.novedadVehiculo.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Novedad no encontrada.' }, { status: 404 });
    }

    const data: { estado?: 'PENDIENTE_REVISION' | 'RESUELTO'; detalleAdmin?: string | null } = {};

    if (body.estado !== undefined) {
      if (body.estado !== 'PENDIENTE_REVISION' && body.estado !== 'RESUELTO') {
        return NextResponse.json({ message: 'Estado de novedad inválido.' }, { status: 400 });
      }
      data.estado = body.estado;
    }

    if (body.detalleAdmin !== undefined) {
      data.detalleAdmin =
        body.detalleAdmin === null || body.detalleAdmin === ''
          ? null
          : String(body.detalleAdmin).trim();
    }

    const novedad = await prisma.novedadVehiculo.update({
      where: { id },
      data,
      select: novedadSelect,
    });

    return NextResponse.json({ data: novedad, message: 'Novedad actualizada.' });
  } catch (error) {
    console.error('[API /novedades-vehiculo PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar la novedad.') },
      { status: 500 },
    );
  }
}
