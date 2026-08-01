import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasAnyRole, type Role } from '@/lib/roles';

const DESTINATARIOS: Role[] = ['ADMINISTRACION', 'CELADORA', 'CHOFER'];

/** Publicaciones vigentes según los roles del usuario. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }
  if (!hasAnyRole(session, [...DESTINATARIOS, 'ADMIN'])) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
  }

  const userRoles = session.roles.filter((r): r is Role => DESTINATARIOS.includes(r));
  // Admin sin rol operativo no ve avisos en banner (los gestiona en su pestaña)
  if (userRoles.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const now = new Date();
  const items = await prisma.publicacion.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      roles: { hasSome: userRoles },
    },
    orderBy: { startsAt: 'desc' },
    take: 10,
    select: {
      id: true,
      titulo: true,
      cuerpo: true,
      imagenUrl: true,
      roles: true,
      startsAt: true,
      endsAt: true,
    },
  });

  return NextResponse.json({ data: items });
}
