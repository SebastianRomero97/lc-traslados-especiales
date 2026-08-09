import { prisma } from '@/lib/prisma';
import { isBaseLcNombre } from '@/lib/base-lc.utils';
import { pickUniqueDestinoColor } from '@/lib/destino-color';

/**
 * Asigna / repara colores de destinos en toda la app:
 * - Base LC → sin color
 * - sin color → nuevo
 * - color duplicado → nuevo
 * Únicos globalmente (no solo por zona).
 */
export async function ensureDestinoColorsGlobal(): Promise<void> {
  const destinos = await prisma.destino.findMany({
    orderBy: [{ createdAt: 'asc' }, { nombre: 'asc' }],
    select: { id: true, color: true, nombre: true },
  });

  const claimed = new Set<string>();
  const updates: { id: string; color: string | null }[] = [];

  for (const d of destinos) {
    if (isBaseLcNombre(d.nombre)) {
      if (d.color) updates.push({ id: d.id, color: null });
      continue;
    }
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

/** Compat: al cargar una zona se repara la unicidad global. */
export async function ensureDestinoColorsForArea(_areaId: string): Promise<void> {
  await ensureDestinoColorsGlobal();
}

/**
 * Color libre para un destino nuevo (único en toda la app).
 * Base LC no recibe color.
 * `areaId` se mantiene por compatibilidad de call-sites; la unicidad es global.
 */
export async function allocateDestinoColor(
  _areaId?: string,
  excludeId?: string,
  nombre?: string,
): Promise<string | null> {
  if (nombre && isBaseLcNombre(nombre)) return null;

  const destinos = await prisma.destino.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      color: { not: null },
    },
    select: { color: true, nombre: true },
  });

  const used = destinos
    .filter((d) => !isBaseLcNombre(d.nombre))
    .map((d) => d.color!)
    .filter(Boolean);

  return pickUniqueDestinoColor(used);
}
