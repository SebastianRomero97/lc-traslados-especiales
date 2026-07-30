import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';

/** Listado y alta de áreas (solo Admin). */
export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const areas = await prisma.area.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      destinos: { orderBy: { nombre: 'asc' } },
      _count: {
        select: {
          destinos: true,
          celadoras: true,
          transportes: true,
          pasajeros: true,
        },
      },
    },
  });

  return NextResponse.json({ data: areas });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as { nombre?: string };
    const nombre = body.nombre?.trim();

    if (!nombre) {
      return NextResponse.json({ message: 'Indicá el nombre del área.' }, { status: 400 });
    }

    const existing = await prisma.area.findUnique({ where: { nombre } });
    if (existing) {
      return NextResponse.json({ message: 'Ya existe un área con ese nombre.' }, { status: 409 });
    }

    const area = await prisma.area.create({
      data: { nombre, active: true },
    });

    return NextResponse.json({ data: area, message: 'Área creada.' }, { status: 201 });
  } catch (error) {
    console.error('[API /admin/areas POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos crear el área.') },
      { status: 500 },
    );
  }
}
