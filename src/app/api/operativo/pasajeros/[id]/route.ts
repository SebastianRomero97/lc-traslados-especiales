import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';
import {
  canAccessAsCeladora,
  canAccessAsChofer,
  findGrillaOperativa,
} from '@/lib/operativo-grilla';
import { hasRole } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

/**
 * Ficha mínima para celadora/chofer en ruta: DNI + contactos.
 * Requiere grillaId y que el pasajero figure en esa grilla.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireOperativoApi(['CELADORA', 'CHOFER']);
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const grillaId = new URL(request.url).searchParams.get('grillaId')?.trim();
  if (!grillaId) {
    return NextResponse.json({ message: 'Falta grillaId.' }, { status: 400 });
  }

  try {
    const grilla = await findGrillaOperativa(grillaId);
    if (!grilla) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    const asCeladora =
      hasRole(auth.user, 'CELADORA') && canAccessAsCeladora(grilla, auth.user.id);
    const asChofer = hasRole(auth.user, 'CHOFER') && canAccessAsChofer(grilla, auth.user.id);
    if (!asCeladora && !asChofer) {
      return NextResponse.json({ message: 'No tenés acceso a esta grilla.' }, { status: 403 });
    }

    const enGrilla = grilla.filas.some((f) => f.pasajeroId === id);
    if (!enGrilla) {
      return NextResponse.json(
        { message: 'Ese pasajero no figura en esta grilla.' },
        { status: 403 },
      );
    }

    const pasajero = await prisma.pasajero.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        dni: true,
        contactos: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, relacion: true, telefono: true },
        },
      },
    });

    if (!pasajero) {
      return NextResponse.json({ message: 'Pasajero no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ data: pasajero });
  } catch (error) {
    console.error('[API /operativo/pasajeros/[id] GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cargar la ficha del pasajero.') },
      { status: 500 },
    );
  }
}
