import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ message: 'Usuario no indicado.' }, { status: 400 });
  }

  if (id === auth.user.id) {
    return NextResponse.json(
      { message: 'No podés eliminar tu propio usuario.' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (existing.role === 'ADMIN') {
      return NextResponse.json(
        { message: 'No se puede eliminar un usuario Admin desde el panel.' },
        { status: 400 },
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuario eliminado.' });
  } catch (error) {
    console.error('[API /admin/users DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar el usuario.') },
      { status: 500 },
    );
  }
}
