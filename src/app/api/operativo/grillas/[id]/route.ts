import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';
import {
  canAccessAsCeladora,
  canAccessAsChofer,
  findGrillaOperativa,
  grillaInclude,
} from '@/lib/operativo-grilla';
import { hasRole } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireOperativoApi(['CELADORA', 'CHOFER']);
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const grilla = await findGrillaOperativa(id);
  if (!grilla) {
    return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
  }

  const asCeladora = hasRole(auth.user, 'CELADORA') && canAccessAsCeladora(grilla, auth.user.id);
  const asChofer = hasRole(auth.user, 'CHOFER') && canAccessAsChofer(grilla, auth.user.id);

  if (!asCeladora && !asChofer) {
    return NextResponse.json({ message: 'No tenés acceso a esta grilla.' }, { status: 403 });
  }

  return NextResponse.json({
    data: grilla,
    meta: { asCeladora, asChofer },
  });
}

/** Iniciar / finalizar recorrido (reloj celadora o chofer). */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireOperativoApi(['CELADORA', 'CHOFER']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      action?: 'iniciar' | 'finalizar';
      rol?: 'CELADORA' | 'CHOFER';
    };

    if (body.action !== 'iniciar' && body.action !== 'finalizar') {
      return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
    }
    if (body.rol !== 'CELADORA' && body.rol !== 'CHOFER') {
      return NextResponse.json({ message: 'Indicá el rol (CELADORA o CHOFER).' }, { status: 400 });
    }
    if (!hasRole(auth.user, body.rol)) {
      return NextResponse.json({ message: 'No tenés ese rol.' }, { status: 403 });
    }

    const grilla = await findGrillaOperativa(id);
    if (!grilla) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    const now = new Date();

    if (body.rol === 'CELADORA') {
      if (!canAccessAsCeladora(grilla, auth.user.id)) {
        return NextResponse.json({ message: 'No sos la celadora de esta grilla.' }, { status: 403 });
      }
      if (body.action === 'iniciar') {
        if (grilla.celadoraInicioAt) {
          return NextResponse.json({ message: 'El recorrido ya fue iniciado.' }, { status: 400 });
        }
        const updated = await prisma.grilla.update({
          where: { id },
          data: { celadoraInicioAt: now },
          include: grillaInclude,
        });
        return NextResponse.json({
          data: updated,
          message: 'Recorrido iniciado (subida de pasajeros).',
        });
      }
      if (!grilla.celadoraInicioAt) {
        return NextResponse.json(
          { message: 'Primero tenés que iniciar el recorrido.' },
          { status: 400 },
        );
      }
      if (grilla.celadoraFinAt) {
        return NextResponse.json({ message: 'El recorrido ya fue finalizado.' }, { status: 400 });
      }
      const updated = await prisma.grilla.update({
        where: { id },
        data: { celadoraFinAt: now },
        include: grillaInclude,
      });
      return NextResponse.json({ data: updated, message: 'Recorrido finalizado.' });
    }

    // CHOFER
    if (!canAccessAsChofer(grilla, auth.user.id)) {
      return NextResponse.json({ message: 'No sos el chofer de esta grilla.' }, { status: 403 });
    }
    if (body.action === 'iniciar') {
      if (grilla.choferInicioAt) {
        return NextResponse.json({ message: 'El manejo ya fue iniciado.' }, { status: 400 });
      }
      const updated = await prisma.grilla.update({
        where: { id },
        data: { choferInicioAt: now },
        include: grillaInclude,
      });
      return NextResponse.json({ data: updated, message: 'Inicio de manejo registrado.' });
    }
    if (!grilla.choferInicioAt) {
      return NextResponse.json(
        { message: 'Primero tenés que iniciar el manejo.' },
        { status: 400 },
      );
    }
    if (grilla.choferFinAt) {
      return NextResponse.json({ message: 'El manejo ya fue finalizado.' }, { status: 400 });
    }
    const updated = await prisma.grilla.update({
      where: { id },
      data: { choferFinAt: now },
      include: grillaInclude,
    });
    return NextResponse.json({ data: updated, message: 'Fin de manejo registrado.' });
  } catch (error) {
    console.error('[API /operativo/grillas POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el recorrido.') },
      { status: 500 },
    );
  }
}
