import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      transporteId?: string | null;
    };

    const chofer = await prisma.user.findUnique({ where: { id } });
    if (!chofer || chofer.role !== 'CHOFER') {
      return NextResponse.json({ message: 'Chofer no encontrado.' }, { status: 404 });
    }

    const transporteId =
      body.transporteId === undefined
        ? undefined
        : body.transporteId === '' || body.transporteId === null
          ? null
          : body.transporteId;

    if (transporteId) {
      const transporte = await prisma.transporte.findUnique({ where: { id: transporteId } });
      if (!transporte || !transporte.active) {
        return NextResponse.json(
          { message: 'El transporte indicado no existe o está inactivo.' },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: transporteId === undefined ? {} : { transporteId },
      select: {
        id: true,
        username: true,
        active: true,
        transporteId: true,
        transporte: {
          select: { id: true, nombre: true, tipo: true, active: true },
        },
      },
    });

    return NextResponse.json({
      data: updated,
      message: 'Asignación de transporte actualizada.',
    });
  } catch (error) {
    console.error('[API /admin/choferes PATCH]', error);
    return NextResponse.json(
      { message: 'No pudimos actualizar la asignación del chofer.' },
      { status: 500 },
    );
  }
}
