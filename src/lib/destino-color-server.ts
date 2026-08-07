import { prisma } from '@/lib/prisma';
import { pickUniqueDestinoColor } from '@/lib/destino-color';

/**
 * Asigna / repara colores de destinos de la zona:
 * - sin color → nuevo
 * - color duplicado en la zona → nuevo
 * Únicos por zona (pueden repetirse entre zonas).
 */
export async function ensureDestinoColorsForArea(areaId: string): Promise<void> {
  const destinos = await prisma.destino.findMany({
    where: { areaId },
    orderBy: [{ createdAt: 'asc' }, { nombre: 'asc' }],
    select: { id: true, color: true },
  });

  const claimed = new Set<string>();
  const updates: { id: string; color: string }[] = [];

  for (const d of destinos) {
    const current = d.color?.trim().toLowerCase() ?? '';
    if (current && !claimed.has(current)) {
      claimed.add(current);
      continue;
    }
    const next = pickUniqueDestinoColor(claimed);
    claimed.add(next.toLowerCase());
    updates.push({ id: d.id, color: next });
  }

  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.destino.update({
        where: { id: u.id },
        data: { color: u.color },
      }),
    ),
  );
}

/** Color libre para un destino nuevo (o al moverlo de zona). */
export async function allocateDestinoColor(areaId: string, excludeId?: string): Promise<string> {
  const destinos = await prisma.destino.findMany({
    where: {
      areaId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      color: { not: null },
    },
    select: { color: true },
  });
  return pickUniqueDestinoColor(destinos.map((d) => d.color!).filter(Boolean));
}
