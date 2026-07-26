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
    if (typeof body.nombre === 'string') {
      const nombre = body.nombre.trim();
      if (!nombre) {
        return NextResponse.json({ message: 'El nombre no puede quedar vacío.' }, { status: 400 });
      }
      data.nombre = nombre;
    }
    if (typeof body.direccion === 'string') {
      const direccion = body.direccion.trim();
      if (!direccion) {
        return NextResponse.json({ message: 'La dirección no puede quedar vacía.' }, { status: 400 });
      }
      data.direccion = direccion;
    }
    if (typeof body.active === 'boolean') data.active = body.active;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'No hay cambios para guardar.' }, { status: 400 });
    }

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
