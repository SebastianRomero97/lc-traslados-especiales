import { prisma } from '@/lib/prisma';

const grillaInclude = {
  area: { select: { id: true, nombre: true } },
  transporte: { select: { id: true, nombre: true, tipo: true } },
  chofer: { select: { id: true, username: true } },
  celadora: { select: { id: true, username: true } },
  puntoEncuentro: {
    select: {
      id: true,
      nombre: true,
      direccion: true,
      frecuente: true,
      lat: true,
      lon: true,
      usarCoordsParaChofer: true,
    },
  },
  filas: { orderBy: { orden: 'asc' as const } },
  asistencias: true,
} as const;

export async function findGrillaOperativa(id: string) {
  return prisma.grilla.findUnique({
    where: { id },
    include: grillaInclude,
  });
}

export type GrillaOperativa = NonNullable<Awaited<ReturnType<typeof findGrillaOperativa>>>;

export function canAccessAsCeladora(grilla: GrillaOperativa, userId: string): boolean {
  return Boolean(grilla.conCeladora && grilla.celadoraId === userId);
}

export function canAccessAsChofer(grilla: GrillaOperativa, userId: string): boolean {
  return grilla.choferId === userId;
}

export function canMarkAsistencia(
  grilla: GrillaOperativa,
  userId: string,
  asRole: 'CELADORA' | 'CHOFER',
): boolean {
  if (asRole === 'CELADORA') {
    return canAccessAsCeladora(grilla, userId);
  }
  // Chofer solo marca asistencia si el recorrido es sin celadora
  return canAccessAsChofer(grilla, userId) && !grilla.conCeladora;
}

export { grillaInclude };
