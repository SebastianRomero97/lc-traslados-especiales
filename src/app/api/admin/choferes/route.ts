import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const [choferes, transportes] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'CHOFER' },
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        active: true,
        transporteId: true,
        transporte: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            active: true,
          },
        },
      },
    }),
    prisma.transporte.findMany({
      where: { active: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);

  return NextResponse.json({ data: { choferes, transportes } });
}
