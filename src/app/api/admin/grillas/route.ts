import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasRole } from '@/lib/roles';
import { describeCaughtError } from '@/lib/api-errors';
import { grillaInclude } from '@/lib/operativo-grilla';
import { isEstadoGrilla, type EstadoGrilla } from '@/lib/grilla-estado';

/** Listado de grillas para revisión Admin (por estado). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }
  if (!hasRole(session, 'ADMIN')) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
  }

  try {
    const estadoParam = new URL(request.url).searchParams.get('estado')?.trim();
    const estados: EstadoGrilla[] =
      estadoParam && isEstadoGrilla(estadoParam)
        ? [estadoParam]
        : ['EN_REVISION', 'OBSERVADA', 'EN_CURSO'];

    const grillas = await prisma.grilla.findMany({
      where: { estado: { in: estados } },
      include: {
        ...grillaInclude,
        cerradoPor: { select: { id: true, username: true } },
      },
      orderBy: [{ fecha: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({ data: grillas });
  } catch (error) {
    console.error('[API /admin/grillas GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cargar las grillas.') },
      { status: 500 },
    );
  }
}
