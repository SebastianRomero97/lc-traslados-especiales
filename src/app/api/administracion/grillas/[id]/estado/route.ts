import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { describeCaughtError } from '@/lib/api-errors';
import {
  grillaBloqueadaOperativa,
  puedeEditarGrillaAdmin,
  puedeEditarGrillaAdministracion,
  puedeVolverABorrador,
  type EstadoGrilla,
} from '@/lib/grilla-estado';
import { hasRole } from '@/lib/roles';
import { grillaInclude } from '@/lib/operativo-grilla';

type Params = { params: Promise<{ id: string }> };

/**
 * Transiciones de estado de grilla (Administración / Admin).
 * actions: enviar_revision | volver_borrador | observar | aprobar
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const esAdmin = hasRole(auth.user, 'ADMIN');

  try {
    const body = (await request.json()) as {
      action?: string;
      notaRevision?: string | null;
    };

    const action = body.action?.trim();
    if (!action) {
      return NextResponse.json({ message: 'Falta la acción.' }, { status: 400 });
    }

    const existing = await prisma.grilla.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    const estado = existing.estado as EstadoGrilla;

    if (grillaBloqueadaOperativa(estado)) {
      return NextResponse.json(
        { message: 'Esta grilla ya está en curso o finalizada y no se puede cambiar.' },
        { status: 400 },
      );
    }

    if (action === 'enviar_revision') {
      if (!puedeEditarGrillaAdministracion(estado) && !(esAdmin && puedeEditarGrillaAdmin(estado))) {
        return NextResponse.json(
          { message: 'Solo se puede enviar a revisión desde Borrador u Observada.' },
          { status: 400 },
        );
      }
      const updated = await prisma.grilla.update({
        where: { id },
        data: { estado: 'EN_REVISION' },
        include: grillaInclude,
      });
      return NextResponse.json({
        data: updated,
        message: 'Grilla enviada a revisión del Admin.',
      });
    }

    if (action === 'volver_borrador') {
      if (!puedeVolverABorrador(estado)) {
        return NextResponse.json(
          { message: 'No se puede volver a borrador desde este estado.' },
          { status: 400 },
        );
      }
      const updated = await prisma.grilla.update({
        where: { id },
        data: { estado: 'BORRADOR' },
        include: grillaInclude,
      });
      return NextResponse.json({
        data: updated,
        message: 'Grilla en borrador. Cuando termines, enviala otra vez a revisión.',
      });
    }

    if (action === 'observar') {
      if (!esAdmin) {
        return NextResponse.json({ message: 'Solo Admin puede observar grillas.' }, { status: 403 });
      }
      if (estado !== 'EN_REVISION' && estado !== 'OBSERVADA') {
        return NextResponse.json(
          { message: 'Solo se pueden observar grillas en revisión.' },
          { status: 400 },
        );
      }
      const nota = body.notaRevision?.trim() || null;
      if (!nota) {
        return NextResponse.json(
          { message: 'Escribí una nota indicando qué hay que corregir.' },
          { status: 400 },
        );
      }
      const updated = await prisma.grilla.update({
        where: { id },
        data: { estado: 'OBSERVADA', notaRevision: nota },
        include: grillaInclude,
      });
      return NextResponse.json({
        data: updated,
        message: 'Grilla observada. Administración debe corregirla.',
      });
    }

    if (action === 'aprobar') {
      if (!esAdmin) {
        return NextResponse.json({ message: 'Solo Admin puede aprobar grillas.' }, { status: 403 });
      }
      if (
        estado !== 'EN_REVISION' &&
        estado !== 'OBSERVADA' &&
        estado !== 'BORRADOR'
      ) {
        return NextResponse.json(
          { message: 'Esta grilla no está pendiente de aprobación.' },
          { status: 400 },
        );
      }
      const updated = await prisma.grilla.update({
        where: { id },
        data: { estado: 'APROBADA', notaRevision: null },
        include: grillaInclude,
      });
      return NextResponse.json({
        data: updated,
        message: 'Grilla aprobada. Ya está lista para empezar.',
      });
    }

    return NextResponse.json({ message: 'Acción no válida.' }, { status: 400 });
  } catch (error) {
    console.error('[API /administracion/grillas/[id]/estado POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el estado.') },
      { status: 500 },
    );
  }
}
