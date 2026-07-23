import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const transportes = await prisma.transporte.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      choferes: {
        where: { role: 'CHOFER' },
        select: { id: true, username: true },
      },
    },
  });

  return NextResponse.json({ data: transportes });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      tipo?: string;
      capacidad?: number | string | null;
    };

    const nombre = body.nombre?.trim();
    const tipo = body.tipo?.trim();
    const capacidadRaw = body.capacidad;
    const capacidad =
      capacidadRaw === '' || capacidadRaw === null || capacidadRaw === undefined
        ? null
        : Number(capacidadRaw);

    if (!nombre || !tipo) {
      return NextResponse.json(
        { message: 'Completá nombre y tipo de transporte.' },
        { status: 400 },
      );
    }

    if (capacidad !== null && (Number.isNaN(capacidad) || capacidad < 1)) {
      return NextResponse.json(
        { message: 'La capacidad debe ser un número mayor a 0.' },
        { status: 400 },
      );
    }

    const transporte = await prisma.transporte.create({
      data: {
        nombre,
        tipo,
        capacidad,
        active: true,
      },
    });

    return NextResponse.json(
      { data: transporte, message: 'Transporte creado.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /admin/transportes POST]', error);
    return NextResponse.json({ message: 'No pudimos crear el transporte.' }, { status: 500 });
  }
}
