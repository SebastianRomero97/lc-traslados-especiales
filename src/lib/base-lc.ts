import { prisma } from '@/lib/prisma';

/** Destino canónico de la empresa (único para todas las áreas). */
export const BASE_LC_NOMBRE = 'Base LC';

export function isBaseLcNombre(nombre: string): boolean {
  return /^base\s*lc$/i.test(nombre.trim());
}

export async function findBaseLcDestino() {
  const destinos = await prisma.destino.findMany({
    where: { active: true },
    select: {
      id: true,
      nombre: true,
      domicilio: true,
      lat: true,
      lon: true,
      usarCoordsParaChofer: true,
      areaId: true,
    },
    take: 200,
  });
  return destinos.find((d) => isBaseLcNombre(d.nombre)) ?? null;
}
