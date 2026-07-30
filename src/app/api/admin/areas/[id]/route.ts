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
    const body = (await request.json()) as { nombre?: string; active?: boolean };
    const existing = await prisma.area.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
    }

    const data: { nombre?: string; active?: boolean } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    if (data.nombre && data.nombre !== existing.nombre) {
      const clash = await prisma.area.findUnique({ where: { nombre: data.nombre } });
      if (clash) {
        return NextResponse.json({ message: 'Ya existe un área con ese nombre.' }, { status: 409 });
      }
    }

    const area = await prisma.area.update({ where: { id }, data });
    return NextResponse.json({ data: area, message: 'Área actualizada.' });
  } catch (error) {
    console.error('[API /admin/areas PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el área.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.area.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
    }

    await prisma.area.delete({ where: { id } });
    return NextResponse.json({ message: 'Área eliminada.' });
  } catch (error) {
    console.error('[API /admin/areas DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar el área.') },
      { status: 500 },
    );
  }
}
