import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import { describeCaughtError } from '@/lib/api-errors';

/** Pool global de recursos para el tablero Área y asignaciones. */
export async function GET() {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  try {
    const [celadoras, choferes, transportes, pasajeros, destinos, areas] = await Promise.all([
      prisma.user.findMany({
        where: { roles: { has: 'CELADORA' }, active: true },
        orderBy: { username: 'asc' },
        select: {
          id: true,
          username: true,
          areasComoCeladora: { select: { areaId: true, area: { select: { id: true, nombre: true } } } },
        },
      }),
      prisma.user.findMany({
        where: { roles: { has: 'CHOFER' }, active: true },
        orderBy: { username: 'asc' },
        select: {
          id: true,
          username: true,
          isPrestador: true,
          transporteId: true,
          transporte: { select: { id: true, nombre: true, tipo: true } },
          areasComoChofer: { select: { areaId: true, area: { select: { id: true, nombre: true } } } },
        },
      }),
      prisma.transporte.findMany({
        where: { active: true },
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          choferes: {
            where: { active: true },
            select: { id: true, username: true, isPrestador: true },
          },
          areas: { select: { areaId: true, area: { select: { id: true, nombre: true } } } },
        },
      }),
      prisma.pasajero.findMany({
        where: { active: true },
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          direccion: true,
          areas: { select: { areaId: true, area: { select: { id: true, nombre: true } } } },
        },
      }),
      prisma.destino.findMany({
        where: { active: true },
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          domicilio: true,
          areaId: true,
          area: { select: { id: true, nombre: true } },
        },
      }),
      prisma.area.findMany({
        where: { active: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true },
      }),
    ]);

    const choferesNormales = choferes.filter((c) => !c.isPrestador);
    const prestadores = choferes.filter((c) => c.isPrestador);

    return NextResponse.json({
      data: {
        areas,
        celadoras: celadoras.map((c) => ({
          id: c.id,
          username: c.username,
          areaIds: c.areasComoCeladora.map((a) => a.areaId),
          areas: c.areasComoCeladora.map((a) => a.area),
        })),
        choferes: choferesNormales.map((c) => ({
          id: c.id,
          username: c.username,
          isPrestador: false,
          transporteId: c.transporteId,
          transporte: c.transporte,
          areaIds: c.areasComoChofer.map((a) => a.areaId),
          areas: c.areasComoChofer.map((a) => a.area),
        })),
        prestadores: prestadores.map((c) => ({
          id: c.id,
          username: c.username,
          isPrestador: true,
          transporteId: c.transporteId,
          transporte: c.transporte,
          areaIds: c.areasComoChofer.map((a) => a.areaId),
          areas: c.areasComoChofer.map((a) => a.area),
        })),
        transportes: transportes.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          tipo: t.tipo,
          choferes: t.choferes,
          areaIds: t.areas.map((a) => a.areaId),
          areas: t.areas.map((a) => a.area),
        })),
        pasajeros: pasajeros.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          direccion: p.direccion,
          areaIds: p.areas.map((a) => a.areaId),
          areas: p.areas.map((a) => a.area),
        })),
        destinos: destinos.map((d) => ({
          id: d.id,
          nombre: d.nombre,
          domicilio: d.domicilio,
          areaId: d.areaId,
          area: d.area,
        })),
      },
    });
  } catch (error) {
    console.error('[API /coord/recursos GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No se pudieron cargar los recursos.') },
      { status: 500 },
    );
  }
}
