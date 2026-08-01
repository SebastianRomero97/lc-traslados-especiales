import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';

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

function parseCoordPair(lat?: number | null, lon?: number | null) {
  if (
    lat == null ||
    lon == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return { lat: null as number | null, lon: null as number | null, ok: false };
  }
  return { lat, lon, ok: true };
}

/** Lista puntos de encuentro de una celadora (frecuentes por defecto). */
export async function GET(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const celadoraId = new URL(request.url).searchParams.get('celadoraId')?.trim();
  if (!celadoraId) {
    return NextResponse.json({ message: 'Indicá celadoraId.' }, { status: 400 });
  }

  const soloFrecuentes = new URL(request.url).searchParams.get('frecuentes') !== '0';

  try {
    const puntos = await prisma.puntoEncuentro.findMany({
      where: {
        celadoraId,
        ...(soloFrecuentes ? { frecuente: true } : {}),
      },
      orderBy: [{ frecuente: 'desc' }, { updatedAt: 'desc' }],
      select: puntoSelect,
    });

    return NextResponse.json({ data: puntos });
  } catch (error) {
    console.error('[API /administracion/puntos-encuentro GET]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(error, 'No se pudieron cargar los puntos de encuentro.'),
      },
      { status: 500 },
    );
  }
}

/** Crea un punto de encuentro vinculado a una celadora. */
export async function POST(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      celadoraId?: string;
      direccion?: string;
      nombre?: string | null;
      frecuente?: boolean;
      lat?: number | null;
      lon?: number | null;
      usarCoordsParaChofer?: boolean;
    };

    const celadoraId = body.celadoraId?.trim() || '';
    const direccion = body.direccion?.trim() || '';
    const nombre = body.nombre?.trim() || null;
    const frecuente = body.frecuente === true;
    const pair = parseCoordPair(body.lat, body.lon);

    const missing = missingFieldsMessage(
      { celadoraId, direccion },
      { celadoraId: 'celadora', direccion: 'dirección del punto de encuentro' },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    const celadora = await prisma.user.findUnique({ where: { id: celadoraId } });
    if (!celadora || !celadora.roles.includes('CELADORA')) {
      return NextResponse.json(
        { message: 'La celadora seleccionada no es válida.' },
        { status: 400 },
      );
    }

    const punto = await prisma.puntoEncuentro.create({
      data: {
        celadoraId,
        direccion,
        nombre,
        frecuente,
        lat: pair.ok ? pair.lat : null,
        lon: pair.ok ? pair.lon : null,
        usarCoordsParaChofer: pair.ok ? Boolean(body.usarCoordsParaChofer) : false,
      },
      select: puntoSelect,
    });

    return NextResponse.json(
      { data: punto, message: frecuente ? 'Punto de encuentro guardado.' : 'Punto de encuentro creado.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /administracion/puntos-encuentro POST]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(error, 'No se pudo crear el punto de encuentro.'),
      },
      { status: 500 },
    );
  }
}
