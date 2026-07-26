import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';

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
    select: {
      id: true,
      mensaje: true,
      createdAt: true,
      transporte: { select: { id: true, nombre: true, tipo: true } },
      reportadoPor: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({ data: novedades });
}
