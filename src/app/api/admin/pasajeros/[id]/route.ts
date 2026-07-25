import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      direccion?: string;
      active?: boolean;
    };

    const existing = await prisma.pasajero.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Pasajero no encontrado.' }, { status: 404 });
    }

    const data: { nombre?: string; direccion?: string; active?: boolean } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.direccion === 'string') data.direccion = body.direccion.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    const pasajero = await prisma.pasajero.update({ where: { id }, data });
    return NextResponse.json({ data: pasajero, message: 'Pasajero actualizado.' });
  } catch (error) {
    console.error('[API /admin/pasajeros PATCH]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar el pasajero.') }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.pasajero.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Pasajero no encontrado.' }, { status: 404 });
    }

    await prisma.pasajero.delete({ where: { id } });
    return NextResponse.json({ message: 'Pasajero eliminado.' });
  } catch (error) {
    console.error('[API /admin/pasajeros DELETE]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos eliminar el pasajero.') }, { status: 500 });
  }
}
