import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';

/** Lista credenciales biométricas del usuario. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }

  try {
    const rows = await prisma.webAuthnCredential.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        deviceType: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('[API webauthn/credentials GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No se pudieron listar las huellas.') },
      { status: 500 },
    );
  }
}

/** Elimina una credencial: body { id }. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ message: 'Falta el id de la credencial.' }, { status: 400 });
    }

    const existing = await prisma.webAuthnCredential.findFirst({
      where: { id, userId: session.id },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Credencial no encontrada.' }, { status: 404 });
    }

    await prisma.webAuthnCredential.delete({ where: { id } });
    return NextResponse.json({ message: 'Huella / Face ID eliminada de este dispositivo.' });
  } catch (error) {
    console.error('[API webauthn/credentials DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No se pudo eliminar la credencial.') },
      { status: 500 },
    );
  }
}
