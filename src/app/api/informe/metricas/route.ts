import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { describeCaughtError } from '@/lib/api-errors';
import { todayFechaInput } from '@/lib/grilla.utils';

function parseDay(value: string | null, fallback: string): Date {
  const raw = value?.trim() || fallback;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return new Date(`${fallback}T00:00:00.000Z`);
  }
  return d;
}

function daysAgoInput(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function durationMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const COMBUSTIBLE_ORDER = ['VACIO', 'CUARTO', 'MEDIO', 'TRES_CUARTOS', 'LLENO'] as const;
const COMBUSTIBLE_LABEL: Record<(typeof COMBUSTIBLE_ORDER)[number], string> = {
  VACIO: 'Vacío',
  CUARTO: '1/4',
  MEDIO: 'Medio',
  TRES_CUARTOS: '3/4',
  LLENO: 'Lleno',
};

type Rango = { desde: Date; hastaExclusive: Date; desdeInput: string; hastaInput: string };

function rangoFromParams(searchParams: URLSearchParams): Rango {
  const hastaInput = searchParams.get('hasta')?.trim() || todayFechaInput();
  const desdeInput = searchParams.get('desde')?.trim() || daysAgoInput(30);
  const desde = parseDay(desdeInput, daysAgoInput(30));
  const hasta = parseDay(hastaInput, todayFechaInput());
  const hastaExclusive = new Date(hasta);
  hastaExclusive.setUTCDate(hastaExclusive.getUTCDate() + 1);
  return { desde, hastaExclusive, desdeInput, hastaInput };
}

/**
 * Informe operativo (Admin + Administración):
 * - sin userId: listado de celadoras y choferes con cantidad de informes en el período
 * - con userId + tipo=celadora|chofer: historial + métricas por ruta (+ destinos / combustible)
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }
  if (!hasAnyRole(session, ['ADMIN', 'ADMINISTRACION'])) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rango = rangoFromParams(searchParams);
    const userId = searchParams.get('userId')?.trim() || undefined;
    const tipo = searchParams.get('tipo')?.trim() as 'celadora' | 'chofer' | undefined;

    if (userId && (tipo === 'celadora' || tipo === 'chofer')) {
      try {
        const data =
          tipo === 'celadora'
            ? await buildCeladoraDetail(userId, rango)
            : await buildChoferDetail(userId, rango);
        return NextResponse.json({ data });
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          return NextResponse.json(
            { message: (error as Error).message },
            { status: 404 },
          );
        }
        throw error;
      }
    }

    return NextResponse.json({
      data: await buildListado(rango),
    });
  } catch (error) {
    console.error('[API /informe/metricas GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cargar el informe.') },
      { status: 500 },
    );
  }
}

async function buildListado(rango: Rango) {
  const fechaWhere = { gte: rango.desde, lt: rango.hastaExclusive };

  const [celadoras, choferes, grillasCel, grillasCho] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { has: 'CELADORA' }, active: true },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    }),
    prisma.user.findMany({
      where: { roles: { has: 'CHOFER' }, active: true },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    }),
    prisma.grilla.groupBy({
      by: ['celadoraId'],
      where: {
        fecha: fechaWhere,
        celadoraId: { not: null },
        informeCeladora: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.grilla.groupBy({
      by: ['choferId'],
      where: {
        fecha: fechaWhere,
        OR: [
          { informeChofer: { not: null } },
          { combustibleNivel: { not: null } },
          { informeChoferVehiculo: { not: null } },
        ],
      },
      _count: { _all: true },
    }),
  ]);

  const countCel = new Map(
    grillasCel.filter((g) => g.celadoraId).map((g) => [g.celadoraId!, g._count._all]),
  );
  const countCho = new Map(grillasCho.map((g) => [g.choferId, g._count._all]));

  return {
    rango: { desde: rango.desdeInput, hasta: rango.hastaInput },
    celadoras: celadoras.map((u) => ({
      id: u.id,
      username: u.username,
      informes: countCel.get(u.id) ?? 0,
    })),
    choferes: choferes.map((u) => ({
      id: u.id,
      username: u.username,
      informes: countCho.get(u.id) ?? 0,
    })),
  };
}

async function buildCeladoraDetail(userId: string, rango: Rango) {
  const user = await prisma.user.findFirst({
    where: { id: userId, roles: { has: 'CELADORA' } },
    select: { id: true, username: true },
  });
  if (!user) {
    throw Object.assign(new Error('Celadora no encontrada.'), { status: 404 });
  }

  const grillas = await prisma.grilla.findMany({
    where: {
      celadoraId: userId,
      fecha: { gte: rango.desde, lt: rango.hastaExclusive },
      informeCeladora: { not: null },
    },
    select: {
      id: true,
      fecha: true,
      tipoItinerario: true,
      nota: true,
      informeCeladora: true,
      celadoraInicioAt: true,
      celadoraFinAt: true,
      area: { select: { id: true, nombre: true } },
      transporte: { select: { id: true, nombre: true, tipo: true } },
      chofer: { select: { id: true, username: true } },
      asistencias: {
        select: {
          estado: true,
          pasajeroId: true,
          pasajeroNombre: true,
        },
      },
    },
    orderBy: { fecha: 'desc' },
  });

  const areaIds = [...new Set(grillas.map((g) => g.area.id))];
  const areaPasajeros = await prisma.areaPasajero.findMany({
    where: { areaId: { in: areaIds } },
    select: {
      areaId: true,
      pasajeroId: true,
      destinoId: true,
      destino: { select: { id: true, nombre: true } },
    },
  });
  const destinoKey = new Map<string, { id: string; nombre: string }>();
  for (const ap of areaPasajeros) {
    if (ap.destinoId && ap.destino) {
      destinoKey.set(`${ap.areaId}:${ap.pasajeroId}`, {
        id: ap.destino.id,
        nombre: ap.destino.nombre,
      });
    }
  }

  const porRutaMap = new Map<
    string,
    {
      transporteId: string;
      transporteNombre: string;
      duraciones: number[];
      asistioPorViaje: number[];
    }
  >();
  const porDestinoMap = new Map<string, { destinoId: string; nombre: string; asistio: number }>();

  const historial = grillas.map((g) => {
    const duracion = durationMinutes(g.celadoraInicioAt, g.celadoraFinAt);
    let asistio = 0;
    let cancelo = 0;

    for (const a of g.asistencias) {
      if (a.estado === 'ASISTIO') {
        asistio += 1;
        if (a.pasajeroId) {
          const dest = destinoKey.get(`${g.area.id}:${a.pasajeroId}`);
          if (dest) {
            const entry = porDestinoMap.get(dest.id) ?? {
              destinoId: dest.id,
              nombre: dest.nombre,
              asistio: 0,
            };
            entry.asistio += 1;
            porDestinoMap.set(dest.id, entry);
          }
        }
      } else {
        cancelo += 1;
      }
    }

    const ruta = porRutaMap.get(g.transporte.id) ?? {
      transporteId: g.transporte.id,
      transporteNombre: g.transporte.nombre,
      duraciones: [] as number[],
      asistioPorViaje: [] as number[],
    };
    if (duracion !== null) ruta.duraciones.push(duracion);
    ruta.asistioPorViaje.push(asistio);
    porRutaMap.set(g.transporte.id, ruta);

    return {
      grillaId: g.id,
      fecha: g.fecha,
      tipoItinerario: g.tipoItinerario,
      area: g.area.nombre,
      transporte: g.transporte.nombre,
      tipoTransporte: g.transporte.tipo,
      chofer: g.chofer.username,
      nota: g.nota,
      informe: g.informeCeladora,
      inicioAt: g.celadoraInicioAt,
      finAt: g.celadoraFinAt,
      duracionMinutos: duracion,
      asistencias: { asistio, cancelo },
    };
  });

  const porRuta = [...porRutaMap.values()]
    .map((r) => ({
      transporteId: r.transporteId,
      transporteNombre: r.transporteNombre,
      promedioDuracionMinutos: avg(r.duraciones),
      muestrasDuracion: r.duraciones.length,
      viajes: r.asistioPorViaje.length,
      promedioPasajerosAsistieron: avg(r.asistioPorViaje),
      totalAsistio: r.asistioPorViaje.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.transporteNombre.localeCompare(b.transporteNombre, 'es'));

  return {
    tipo: 'celadora' as const,
    rango: { desde: rango.desdeInput, hasta: rango.hastaInput },
    persona: user,
    historial,
    porRuta,
    porDestino: [...porDestinoMap.values()].sort((a, b) => b.asistio - a.asistio),
  };
}

async function buildChoferDetail(userId: string, rango: Rango) {
  const user = await prisma.user.findFirst({
    where: { id: userId, roles: { has: 'CHOFER' } },
    select: {
      id: true,
      username: true,
      transporte: { select: { id: true, nombre: true, tipo: true } },
    },
  });
  if (!user) {
    throw Object.assign(new Error('Chofer no encontrado.'), { status: 404 });
  }

  const grillas = await prisma.grilla.findMany({
    where: {
      choferId: userId,
      fecha: { gte: rango.desde, lt: rango.hastaExclusive },
      OR: [
        { informeChofer: { not: null } },
        { combustibleNivel: { not: null } },
        { informeChoferVehiculo: { not: null } },
        { choferFinAt: { not: null } },
      ],
    },
    select: {
      id: true,
      fecha: true,
      tipoItinerario: true,
      nota: true,
      informeChofer: true,
      informeChoferCeladora: true,
      informeChoferVehiculo: true,
      combustibleNivel: true,
      choferInicioAt: true,
      choferFinAt: true,
      area: { select: { id: true, nombre: true } },
      transporte: { select: { id: true, nombre: true, tipo: true } },
      celadora: { select: { id: true, username: true } },
      conCeladora: true,
    },
    orderBy: { fecha: 'desc' },
  });

  const porRutaMap = new Map<
    string,
    { transporteId: string; transporteNombre: string; duraciones: number[] }
  >();
  const combustibleCount = new Map<string, number>();
  for (const nivel of COMBUSTIBLE_ORDER) combustibleCount.set(nivel, 0);

  const historial = grillas.map((g) => {
    const duracion = durationMinutes(g.choferInicioAt, g.choferFinAt);
    if (duracion !== null) {
      const ruta = porRutaMap.get(g.transporte.id) ?? {
        transporteId: g.transporte.id,
        transporteNombre: g.transporte.nombre,
        duraciones: [] as number[],
      };
      ruta.duraciones.push(duracion);
      porRutaMap.set(g.transporte.id, ruta);
    }
    if (g.combustibleNivel) {
      combustibleCount.set(
        g.combustibleNivel,
        (combustibleCount.get(g.combustibleNivel) ?? 0) + 1,
      );
    }

    return {
      grillaId: g.id,
      fecha: g.fecha,
      tipoItinerario: g.tipoItinerario,
      area: g.area.nombre,
      transporte: g.transporte.nombre,
      tipoTransporte: g.transporte.tipo,
      celadora: g.celadora?.username ?? null,
      conCeladora: g.conCeladora,
      nota: g.nota,
      informe: g.informeChofer,
      informeCeladoraObs: g.informeChoferCeladora,
      informeVehiculo: g.informeChoferVehiculo,
      combustibleNivel: g.combustibleNivel,
      inicioAt: g.choferInicioAt,
      finAt: g.choferFinAt,
      duracionMinutos: duracion,
    };
  });

  const porRuta = [...porRutaMap.values()]
    .map((r) => ({
      transporteId: r.transporteId,
      transporteNombre: r.transporteNombre,
      promedioDuracionMinutos: avg(r.duraciones),
      muestrasDuracion: r.duraciones.length,
      viajes: r.duraciones.length,
    }))
    .sort((a, b) => a.transporteNombre.localeCompare(b.transporteNombre, 'es'));

  const combustible = COMBUSTIBLE_ORDER.map((nivel) => ({
    nivel,
    label: COMBUSTIBLE_LABEL[nivel],
    count: combustibleCount.get(nivel) ?? 0,
  }));

  return {
    tipo: 'chofer' as const,
    rango: { desde: rango.desdeInput, hasta: rango.hastaInput },
    persona: {
      id: user.id,
      username: user.username,
      vehiculo: user.transporte,
    },
    historial,
    porRuta,
    combustible,
  };
}
