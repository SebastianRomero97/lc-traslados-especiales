import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdministracionApi } from '@/lib/administracion-auth';

/** Opciones para armar una grilla según el área seleccionada */
export async function GET(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const areaId = new URL(request.url).searchParams.get('areaId')?.trim();
  if (!areaId) {
    return NextResponse.json({ message: 'Indicá areaId.' }, { status: 400 });
  }

  const area = await prisma.area.findUnique({
    where: { id: areaId },
    include: {
      transportes: {
        include: {
          transporte: {
            select: {
              id: true,
              nombre: true,
              tipo: true,
              active: true,
              choferes: {
                where: { active: true, roles: { has: 'CHOFER' } },
                select: { id: true, username: true },
              },
              celadoras: {
                include: {
                  user: { select: { id: true, username: true, active: true } },
                },
              },
            },
          },
        },
      },
      celadoras: {
        include: {
          user: { select: { id: true, username: true, active: true } },
        },
      },
      pasajeros: {
        include: {
          pasajero: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              lat: true,
              lon: true,
              usarCoordsParaChofer: true,
              active: true,
            },
          },
          destinos: { select: { destinoId: true } },
        },
      },
      destinos: {
        where: { active: true },
        select: {
          id: true,
          nombre: true,
          domicilio: true,
          lat: true,
          lon: true,
          usarCoordsParaChofer: true,
        },
        orderBy: { nombre: 'asc' },
      },
    },
  });

  if (!area) {
    return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
  }

  const choferes = await prisma.user.findMany({
    where: { roles: { has: 'CHOFER' }, active: true },
    select: { id: true, username: true, transporteId: true },
    orderBy: { username: 'asc' },
  });

  return NextResponse.json({
    data: {
      area: { id: area.id, nombre: area.nombre },
      transportes: area.transportes
        .map((t) => t.transporte)
        .filter((t) => t.active)
        .map((t) => ({
          id: t.id,
          nombre: t.nombre,
          tipo: t.tipo,
          choferes: t.choferes,
          celadoras: t.celadoras
            .filter((c) => c.user.active)
            .map((c) => c.user),
        })),
      celadoras: area.celadoras
        .filter((c) => c.user.active)
        .map((c) => c.user),
      pasajeros: area.pasajeros
        .filter((p) => p.pasajero.active)
        .map((p) => ({
          ...p.pasajero,
          destinoIds: p.destinos.map((d) => d.destinoId),
          /** Compat: primer destino (UI vieja de grillas). */
          destinoId: p.destinos[0]?.destinoId ?? null,
        })),
      destinos: area.destinos,
      choferes,
    },
  });
}
