import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import {
  puedeCierreAdminEmergencia,
  type EstadoGrilla,
  type TipoCierreGrilla,
} from '@/lib/grilla-estado';
import { grillaInclude } from '@/lib/operativo-grilla';

type Params = { params: Promise<{ id: string }> };

/**
 * Cierre de emergencia Admin sobre grilla EN_CURSO.
 * actions: forzar_finalizar | interrumpir
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      action?: string;
      cierreNota?: string | null;
    };

    const action = body.action?.trim();
    const nota = body.cierreNota?.trim() ?? '';

    if (action !== 'forzar_finalizar' && action !== 'interrumpir') {
      return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
    }
    if (!nota) {
      return NextResponse.json(
        { message: 'La observación del Admin es obligatoria.' },
        { status: 400 },
      );
    }

    const existing = await prisma.grilla.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    const estado = existing.estado as EstadoGrilla;
    if (estado === 'FINALIZADA') {
      return NextResponse.json(
        { message: 'Esta grilla ya está finalizada.' },
        { status: 400 },
      );
    }
    if (!puedeCierreAdminEmergencia(estado)) {
      return NextResponse.json(
        {
          message:
            'Solo se puede forzar el cierre o interrumpir una grilla que esté iniciada.',
        },
        { status: 400 },
      );
    }

    const cierreTipo: TipoCierreGrilla =
      action === 'forzar_finalizar' ? 'FORZADO_ADMIN' : 'INTERRUMPIDO';
    const now = new Date();

    const updated = await prisma.grilla.update({
      where: { id },
      data: {
        estado: 'FINALIZADA',
        cierreTipo,
        cierreNota: nota,
        cerradoPorId: auth.user.id,
        cerradoAt: now,
        // Completar relojes abiertos para no dejar duraciones colgadas.
        ...(existing.choferInicioAt && !existing.choferFinAt
          ? { choferFinAt: now }
          : {}),
        ...(existing.celadoraInicioAt && !existing.celadoraFinAt
          ? { celadoraFinAt: now }
          : {}),
      },
      include: {
        ...grillaInclude,
        cerradoPor: { select: { id: true, username: true } },
      },
    });

    const mensaje =
      cierreTipo === 'FORZADO_ADMIN'
        ? 'Recorrido finalizado de forma forzada.'
        : 'Recorrido marcado como interrumpido.';

    return NextResponse.json({ data: updated, message: mensaje });
  } catch (error) {
    console.error('[API /admin/grillas/[id]/cierre POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cerrar la grilla.') },
      { status: 500 },
    );
  }
}
