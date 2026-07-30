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
      domicilio?: string;
      active?: boolean;
    };

    const existing = await prisma.destino.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Destino no encontrado.' }, { status: 404 });
    }

    const data: { nombre?: string; domicilio?: string; active?: boolean } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.domicilio === 'string') data.domicilio = body.domicilio.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    if (data.nombre === '' || data.domicilio === '') {
      return NextResponse.json(
        { message: 'El nombre y el domicilio no pueden quedar vacíos.' },
        { status: 400 },
      );
    }

    const destino = await prisma.destino.update({ where: { id }, data });
    return NextResponse.json({ data: destino, message: 'Destino actualizado.' });
  } catch (error) {
    console.error('[API /admin/destinos PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el destino.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.destino.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Destino no encontrado.' }, { status: 404 });
    }

    await prisma.destino.delete({ where: { id } });
    return NextResponse.json({ message: 'Destino eliminado.' });
  } catch (error) {
    console.error('[API /admin/destinos DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar el destino.') },
      { status: 500 },
    );
  }
}
