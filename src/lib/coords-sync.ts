import type { Prisma } from '@/generated/prisma/client';
import type { GrillaFilaInput } from '@/lib/grilla.utils';

function parseCoord(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (Math.abs(value) > 180) return null;
  return value;
}

export function filaCoordsData(fila: GrillaFilaInput) {
  const lat = parseCoord(fila.lat ?? null);
  const lon = parseCoord(fila.lon ?? null);
  const both = lat != null && lon != null;
  return {
    lat: both ? lat : null,
    lon: both ? lon : null,
    usarCoordsParaChofer: both ? Boolean(fila.usarCoordsParaChofer) : false,
  };
}

/** Persiste lat/lon (y flag chofer si está activo) en Pasajero / Destino de origen. */
export async function syncCoordsToSources(
  tx: Prisma.TransactionClient,
  filas: GrillaFilaInput[],
) {
  for (const fila of filas) {
    const coords = filaCoordsData(fila);
    if (coords.lat == null || coords.lon == null) continue;

    if (fila.pasajeroId) {
      await tx.pasajero.update({
        where: { id: fila.pasajeroId },
        data: {
          lat: coords.lat,
          lon: coords.lon,
          ...(coords.usarCoordsParaChofer ? { usarCoordsParaChofer: true } : {}),
        },
      });
    }
    if (fila.destinoId && !fila.pasajeroId) {
      await tx.destino.update({
        where: { id: fila.destinoId },
        data: {
          lat: coords.lat,
          lon: coords.lon,
          ...(coords.usarCoordsParaChofer ? { usarCoordsParaChofer: true } : {}),
        },
      });
    }
  }
}
