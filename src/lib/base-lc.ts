import { prisma } from '@/lib/prisma';
import { isBaseLcNombre } from '@/lib/base-lc.utils';

export { BASE_LC_NOMBRE, isBaseLcNombre } from '@/lib/base-lc.utils';

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
