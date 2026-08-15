import { prisma } from '@/lib/prisma';
import {
  isTrasbordoSujeto,
  normalizeAccion,
  type GrillaFilaInput,
  type TrasbordoSujeto,
} from '@/lib/grilla.utils';
import { filaCoordsData } from '@/lib/coords-sync';

export type TrasbordoFilaPersist = {
  orden: number;
  hora: string | null;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId: string | null;
  destinoId: string | null;
  accion: ReturnType<typeof normalizeAccion>;
  trasbordoHacia: string | null;
  trasbordoSujeto: TrasbordoSujeto | null;
  trasbordoTransporteId: string | null;
  lat: number | null;
  lon: number | null;
  usarCoordsParaChofer: boolean;
};

/**
 * Valida filas de trasbordo y arma el payload de createMany.
 * Retorna message de error o los datos listos + si hay trasbordo de celadora.
 */
export async function prepareGrillaFilasForSave(params: {
  filas: GrillaFilaInput[];
  celadoraId: string | null;
  celadoraUsername?: string | null;
}): Promise<
  | { ok: true; rows: TrasbordoFilaPersist[]; tieneTrasbordoCeladora: boolean }
  | { ok: false; message: string }
> {
  const { filas, celadoraId, celadoraUsername } = params;
  let tieneTrasbordoCeladora = false;

  const transporteIds = [
    ...new Set(
      filas
        .map((f) => f.trasbordoTransporteId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const transportes =
    transporteIds.length > 0
      ? await prisma.transporte.findMany({
          where: { id: { in: transporteIds } },
          select: { id: true, nombre: true },
        })
      : [];
  const transporteNombreById = new Map(transportes.map((t) => [t.id, t.nombre]));

  const rows: TrasbordoFilaPersist[] = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const n = i + 1;
    const accion = normalizeAccion(fila.accion);
    const coords = filaCoordsData(fila);

    if (accion !== 'TRASBORDO') {
      rows.push({
        orden: n,
        hora: fila.hora?.trim() || null,
        direccion: fila.direccion.trim(),
        pasajeroNombre: fila.pasajeroNombre.trim(),
        pasajeroId: fila.pasajeroId?.trim() || null,
        destinoId: fila.destinoId?.trim() || null,
        accion,
        trasbordoHacia: null,
        trasbordoSujeto: null,
        trasbordoTransporteId: null,
        ...coords,
      });
      continue;
    }

    const sujetoRaw = fila.trasbordoSujeto?.toString().trim() || '';
    if (!isTrasbordoSujeto(sujetoRaw)) {
      return {
        ok: false,
        message: `Indicá si el trasbordo es de pasajero o celadora (fila ${n}).`,
      };
    }
    const sujeto = sujetoRaw;

    const transporteId = fila.trasbordoTransporteId?.trim() || '';
    if (!transporteId) {
      return {
        ok: false,
        message: `Seleccioná el vehículo de trasbordo (fila ${n}).`,
      };
    }
    const transporteNombre =
      transporteNombreById.get(transporteId) || fila.trasbordoHacia?.trim() || '';
    if (!transporteNombreById.has(transporteId)) {
      return {
        ok: false,
        message: `El vehículo de trasbordo no es válido (fila ${n}).`,
      };
    }

    const destinoId = fila.destinoId?.trim() || null;
    const direccion = fila.direccion?.trim() || '';
    if (!destinoId && !direccion) {
      return {
        ok: false,
        message: `Indicá un destino o una dirección para el punto de trasbordo (fila ${n}).`,
      };
    }

    let pasajeroNombre = fila.pasajeroNombre?.trim() || '';
    let pasajeroId = fila.pasajeroId?.trim() || null;

    if (sujeto === 'PASAJERO') {
      if (!pasajeroNombre && !pasajeroId) {
        return {
          ok: false,
          message: `Indicá el pasajero del trasbordo (fila ${n}).`,
        };
      }
    } else {
      if (!celadoraId) {
        return {
          ok: false,
          message: `Para trasbordo de celadora, asigná una celadora a la grilla (fila ${n}).`,
        };
      }
      pasajeroNombre = celadoraUsername?.trim() || pasajeroNombre || 'Celadora';
      pasajeroId = null;
      tieneTrasbordoCeladora = true;
    }

    let direccionFinal = direccion;
    if (destinoId && !direccionFinal) {
      const destino = await prisma.destino.findUnique({
        where: { id: destinoId },
        select: { domicilio: true, nombre: true },
      });
      direccionFinal = destino?.domicilio?.trim() || destino?.nombre || '';
    }
    if (!direccionFinal) {
      return {
        ok: false,
        message: `Falta la dirección del punto de trasbordo (fila ${n}).`,
      };
    }

    rows.push({
      orden: n,
      hora: fila.hora?.trim() || null,
      direccion: direccionFinal,
      pasajeroNombre,
      pasajeroId,
      destinoId,
      accion,
      trasbordoHacia: transporteNombre,
      trasbordoSujeto: sujeto,
      trasbordoTransporteId: transporteId,
      ...coords,
    });
  }

  return { ok: true, rows, tieneTrasbordoCeladora };
}
