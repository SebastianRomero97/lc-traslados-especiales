import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const pasajeros = await prisma.pasajero.findMany({
    orderBy: { nombre: 'asc' },
  });

  return NextResponse.json({ data: pasajeros });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      direccion?: string;
    };

    const nombre = body.nombre?.trim();
    const direccion = body.direccion?.trim();

    if (!nombre || !direccion) {
      return NextResponse.json(
        { message: 'Completá nombre y dirección del pasajero.' },
        { status: 400 },
      );
    }

    const pasajero = await prisma.pasajero.create({
      data: {
        nombre,
        direccion,
        active: true,
      },
    });

    return NextResponse.json(
      { data: pasajero, message: 'Pasajero creado.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /admin/pasajeros POST]', error);
    return NextResponse.json({ message: 'No pudimos crear el pasajero.' }, { status: 500 });
  }
}
