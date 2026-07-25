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
      tipo?: string;
      capacidad?: number | string | null;
      active?: boolean;
    };

    const existing = await prisma.transporte.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Transporte no encontrado.' }, { status: 404 });
    }

    const data: {
      nombre?: string;
      tipo?: string;
      capacidad?: number | null;
      active?: boolean;
    } = {};

    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.tipo === 'string') data.tipo = body.tipo.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    if (body.capacidad !== undefined) {
      if (body.capacidad === '' || body.capacidad === null) {
        data.capacidad = null;
      } else {
        const capacidad = Number(body.capacidad);
        if (Number.isNaN(capacidad) || capacidad < 1) {
          return NextResponse.json(
            { message: 'La capacidad debe ser un número mayor a 0.' },
            { status: 400 },
          );
        }
        data.capacidad = capacidad;
      }
    }

    const transporte = await prisma.transporte.update({ where: { id }, data });
    return NextResponse.json({ data: transporte, message: 'Transporte actualizado.' });
  } catch (error) {
    console.error('[API /admin/transportes PATCH]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar el transporte.') }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.transporte.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Transporte no encontrado.' }, { status: 404 });
    }

    await prisma.transporte.delete({ where: { id } });
    return NextResponse.json({ message: 'Transporte eliminado.' });
  } catch (error) {
    console.error('[API /admin/transportes DELETE]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos eliminar el transporte.') }, { status: 500 });
  }
}
