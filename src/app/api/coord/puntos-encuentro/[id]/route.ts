import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Params = { params: Promise<{ id: string }> };

const puntoSelect = {
  id: true,
  nombre: true,
  direccion: true,
  frecuente: true,
  celadoraId: true,
  lat: true,
  lon: true,
  usarCoordsParaChofer: true,
} as const;

/** Actualiza coordenadas / flag Maps-Waze de un punto de encuentro. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.puntoEncuentro.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Punto de encuentro no encontrado.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      lat?: number | null;
      lon?: number | null;
      usarCoordsParaChofer?: boolean;
      nombre?: string | null;
      direccion?: string;
      frecuente?: boolean;
    };

    const lat = body.lat === undefined ? existing.lat : body.lat;
    const lon = body.lon === undefined ? existing.lon : body.lon;
    const bothOk =
      lat != null &&
      lon != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180;

    const punto = await prisma.puntoEncuentro.update({
      where: { id },
      data: {
        lat: bothOk ? lat : body.lat === null ? null : existing.lat,
        lon: bothOk ? lon : body.lon === null ? null : existing.lon,
        usarCoordsParaChofer:
          body.usarCoordsParaChofer === undefined
            ? existing.usarCoordsParaChofer
            : Boolean(body.usarCoordsParaChofer) && bothOk,
        nombre: body.nombre === undefined ? undefined : body.nombre?.trim() || null,
        direccion: body.direccion === undefined ? undefined : body.direccion.trim(),
        frecuente: body.frecuente === undefined ? undefined : body.frecuente,
      },
      select: puntoSelect,
    });

    return NextResponse.json({ data: punto, message: 'Punto de encuentro actualizado.' });
  } catch (error) {
    console.error('[API /coord/puntos-encuentro PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No se pudo actualizar el punto de encuentro.') },
      { status: 500 },
    );
  }
}
