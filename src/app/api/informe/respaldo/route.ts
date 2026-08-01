import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { describeCaughtError } from '@/lib/api-errors';
import { todayFechaInput } from '@/lib/grilla.utils';
import {
  buildAsistenciasCsv,
  buildGrillasCsv,
  buildRespaldoPrintHtml,
  durationMinutes,
  type RespaldoGrilla,
} from '@/lib/respaldo-historial';

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

/** Listado + export CSV/HTML de historiales (Admin y Coordinadora). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }
  if (!hasAnyRole(session, ['ADMIN', 'COORDINADORA'])) {
    return NextResponse.json({ message: 'No autorizado.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const hastaInput = searchParams.get('hasta')?.trim() || todayFechaInput();
    const desdeInput = searchParams.get('desde')?.trim() || daysAgoInput(30);
    const areaId = searchParams.get('areaId')?.trim() || undefined;
    const transporteId = searchParams.get('transporteId')?.trim() || undefined;
    const pasajeroId = searchParams.get('pasajeroId')?.trim() || undefined;
    const formato = (searchParams.get('formato')?.trim() || 'json') as
      | 'json'
      | 'csv-grillas'
      | 'csv-asistencias'
      | 'html';

    const desde = parseDay(desdeInput, daysAgoInput(30));
    const hasta = parseDay(hastaInput, todayFechaInput());
    const hastaExclusive = new Date(hasta);
    hastaExclusive.setUTCDate(hastaExclusive.getUTCDate() + 1);

    const [areas, transportes, pasajeros] = await Promise.all([
      prisma.area.findMany({
        where: { active: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.transporte.findMany({
        where: { active: true },
        select: { id: true, nombre: true, tipo: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.pasajero.findMany({
        where: { active: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const grillasDb = await prisma.grilla.findMany({
      where: {
        fecha: { gte: desde, lt: hastaExclusive },
        ...(areaId ? { areaId } : {}),
        ...(transporteId ? { transporteId } : {}),
        ...(pasajeroId
          ? {
              OR: [
                { asistencias: { some: { pasajeroId } } },
                { filas: { some: { pasajeroId } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        fecha: true,
        tipoItinerario: true,
        nota: true,
        conCeladora: true,
        choferInicioAt: true,
        choferFinAt: true,
        celadoraInicioAt: true,
        celadoraFinAt: true,
        informeChofer: true,
        informeCeladora: true,
        informeChoferCeladora: true,
        informeChoferVehiculo: true,
        combustibleNivel: true,
        area: { select: { nombre: true } },
        transporte: { select: { nombre: true, tipo: true } },
        chofer: { select: { username: true } },
        celadora: { select: { username: true } },
        filas: {
          orderBy: { orden: 'asc' },
          select: {
            hora: true,
            direccion: true,
            pasajeroNombre: true,
            pasajeroId: true,
            accion: true,
            trasbordoHacia: true,
          },
        },
        asistencias: {
          select: {
            pasajeroNombre: true,
            estado: true,
            motivoCancelacion: true,
            pasajeroId: true,
          },
        },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    const grillas: RespaldoGrilla[] = grillasDb.map((g) => {
      let asistio = 0;
      let cancelo = 0;
      let noSePresento = 0;
      for (const a of g.asistencias) {
        if (a.estado === 'ASISTIO') asistio += 1;
        else if (a.estado === 'CANCELO') cancelo += 1;
        else noSePresento += 1;
      }
      return {
        id: g.id,
        nombre: g.nombre,
        fecha: g.fecha.toISOString(),
        tipoItinerario: g.tipoItinerario,
        area: g.area.nombre,
        transporte: g.transporte.nombre,
        tipoTransporte: g.transporte.tipo,
        chofer: g.chofer.username,
        celadora: g.celadora?.username ?? null,
        conCeladora: g.conCeladora,
        nota: g.nota,
        choferMinutos: durationMinutes(g.choferInicioAt, g.choferFinAt),
        celadoraMinutos: durationMinutes(g.celadoraInicioAt, g.celadoraFinAt),
        informeChofer: g.informeChofer,
        informeCeladora: g.informeCeladora,
        informeChoferCeladora: g.informeChoferCeladora,
        informeChoferVehiculo: g.informeChoferVehiculo,
        combustibleNivel: g.combustibleNivel,
        asistio,
        cancelo,
        noSePresento,
        filas: g.filas,
        asistencias: g.asistencias.map((a) => ({
          pasajeroNombre: a.pasajeroNombre,
          estado: a.estado,
          motivoCancelacion: a.motivoCancelacion,
        })),
      };
    });

    const filtrosResumen = [
      areaId ? `Área: ${areas.find((a) => a.id === areaId)?.nombre ?? areaId}` : 'Área: todas',
      transporteId
        ? `Transporte: ${transportes.find((t) => t.id === transporteId)?.nombre ?? transporteId}`
        : 'Transporte: todos',
      pasajeroId
        ? `Pasajero: ${pasajeros.find((p) => p.id === pasajeroId)?.nombre ?? pasajeroId}`
        : 'Pasajero: todos',
    ].join(' · ');

    if (formato === 'csv-grillas') {
      return new NextResponse(buildGrillasCsv(grillas), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="lc-grillas-${desdeInput}_${hastaInput}.csv"`,
        },
      });
    }

    if (formato === 'csv-asistencias') {
      return new NextResponse(buildAsistenciasCsv(grillas), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="lc-asistencias-${desdeInput}_${hastaInput}.csv"`,
        },
      });
    }

    if (formato === 'html') {
      const html = buildRespaldoPrintHtml({
        titulo: 'Respaldo de historiales — LC Traslados Especiales',
        desde: desdeInput,
        hasta: hastaInput,
        filtrosResumen,
        grillas,
      });
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json({
      data: {
        rango: { desde: desdeInput, hasta: hastaInput },
        filtrosResumen,
        opciones: { areas, transportes, pasajeros },
        total: grillas.length,
        grillas,
      },
    });
  } catch (error) {
    console.error('[API /informe/respaldo GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos armar el respaldo.') },
      { status: 500 },
    );
  }
}
