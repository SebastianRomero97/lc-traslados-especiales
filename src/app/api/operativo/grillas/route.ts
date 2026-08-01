import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOperativoApi } from '@/lib/operativo-auth';
import { grillaInclude } from '@/lib/operativo-grilla';
import { hasRole } from '@/lib/roles';

/** Grillas asignadas al usuario logueado (como celadora y/o chofer). */
export async function GET(request: Request) {
  const auth = await requireOperativoApi(['CELADORA', 'CHOFER']);
  if ('error' in auth) return auth.error;

  const rol = new URL(request.url).searchParams.get('rol'); // CELADORA | CHOFER | (ambos)
  const asCeladora = !rol || rol === 'CELADORA';
  const asChofer = !rol || rol === 'CHOFER';

  const or: { celadoraId?: string; choferId?: string }[] = [];
  if (asCeladora && hasRole(auth.user, 'CELADORA')) {
    or.push({ celadoraId: auth.user.id });
  }
  if (asChofer && hasRole(auth.user, 'CHOFER')) {
    or.push({ choferId: auth.user.id });
  }

  if (or.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const grillas = await prisma.grilla.findMany({
    where: {
      OR: or,
      estado: { in: ['APROBADA', 'EN_CURSO', 'FINALIZADA'] },
    },
    include: grillaInclude,
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    take: 40,
  });

  return NextResponse.json({ data: grillas });
}
