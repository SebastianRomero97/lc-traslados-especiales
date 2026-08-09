import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { ensureDestinoColorsGlobal } from '@/lib/destino-color-server';

type ZonaMeta = { zonaId: string; zonaNombre: string; esZonaActual: boolean };

/** Opciones para armar una grilla.
 * - Sin hibrida: solo recursos de la zona (areaId).
 * - Con hibrida=1: zona principal + recursos de las demás (etiquetados).
 */
export async function GET(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const searchParams = new URL(request.url).searchParams;
  const areaId = searchParams.get('areaId')?.trim();
  const hibrida =
    searchParams.get('hibrida') === '1' ||
    searchParams.get('hibrida') === 'true';
  if (!areaId) {
    return NextResponse.json({ message: 'Indicá areaId.' }, { status: 400 });
  }

  await ensureDestinoColorsGlobal();

  const areas = await prisma.area.findMany({
    where: { active: true },
    orderBy: { nombre: 'asc' },
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
      choferes: {
        include: {
          user: { select: { id: true, username: true, active: true, transporteId: true } },
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
          color: true,
        },
        orderBy: { nombre: 'asc' },
      },
    },
  });

  const current = areas.find((a) => a.id === areaId);
  if (!current) {
    return NextResponse.json({ message: 'Zona no encontrada.' }, { status: 404 });
  }

  const zonaMeta = (zonaId: string, zonaNombre: string): ZonaMeta => ({
    zonaId,
    zonaNombre,
    esZonaActual: zonaId === areaId,
  });

  type TransporteOut = {
    id: string;
    nombre: string;
    tipo: string;
    choferes: { id: string; username: string }[];
    celadoras: { id: string; username: string }[];
  } & ZonaMeta;

  type PersonaOut = { id: string; username: string; transporteId?: string | null } & ZonaMeta;
  type PasajeroOut = {
    id: string;
    nombre: string;
    direccion: string;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
    destinoIds: string[];
    destinoId: string | null;
  } & ZonaMeta;
  type DestinoOut = {
    id: string;
    nombre: string;
    domicilio: string;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
    color?: string | null;
  } & ZonaMeta;

  const transportesById = new Map<string, TransporteOut>();
  const celadorasById = new Map<string, PersonaOut>();
  const choferesById = new Map<string, PersonaOut>();
  const pasajerosById = new Map<string, PasajeroOut>();
  const destinosById = new Map<string, DestinoOut>();

  const preferCurrent = <T extends ZonaMeta>(map: Map<string, T>, id: string, item: T) => {
    const prev = map.get(id);
    if (!prev || (!prev.esZonaActual && item.esZonaActual)) {
      map.set(id, item);
    }
  };

  // Zona principal primero; en modo híbrido se suman el resto de zonas.
  const ordered = hibrida
    ? [current, ...areas.filter((a) => a.id !== areaId)]
    : [current];

  for (const area of ordered) {
    const meta = zonaMeta(area.id, area.nombre);

    for (const link of area.transportes) {
      const t = link.transporte;
      if (!t.active) continue;
      preferCurrent(transportesById, t.id, {
        id: t.id,
        nombre: t.nombre,
        tipo: t.tipo,
        choferes: t.choferes,
        celadoras: t.celadoras.filter((c) => c.user.active).map((c) => c.user),
        ...meta,
      });
    }

    for (const link of area.celadoras) {
      if (!link.user.active) continue;
      preferCurrent(celadorasById, link.user.id, {
        id: link.user.id,
        username: link.user.username,
        ...meta,
      });
    }

    for (const link of area.choferes) {
      if (!link.user.active) continue;
      preferCurrent(choferesById, link.user.id, {
        id: link.user.id,
        username: link.user.username,
        transporteId: link.user.transporteId,
        ...meta,
      });
    }

    for (const link of area.pasajeros) {
      if (!link.pasajero.active) continue;
      preferCurrent(pasajerosById, link.pasajero.id, {
        ...link.pasajero,
        destinoIds: link.destinos.map((d) => d.destinoId),
        destinoId: link.destinos[0]?.destinoId ?? null,
        ...meta,
      });
    }

    for (const d of area.destinos) {
      preferCurrent(destinosById, d.id, { ...d, ...meta });
    }
  }

  // Choferes activos sin zona (solo vehículo): complementan el pool.
  const choferesSueltos = await prisma.user.findMany({
    where: { roles: { has: 'CHOFER' }, active: true },
    select: { id: true, username: true, transporteId: true },
    orderBy: { username: 'asc' },
  });
  for (const c of choferesSueltos) {
    if (choferesById.has(c.id)) continue;
    choferesById.set(c.id, {
      id: c.id,
      username: c.username,
      transporteId: c.transporteId,
      zonaId: areaId,
      zonaNombre: 'Sin zona',
      esZonaActual: false,
    });
  }

  const sortActualFirst = <T extends ZonaMeta & { nombre?: string; username?: string }>(
    list: T[],
  ) =>
    list.sort((a, b) => {
      if (a.esZonaActual !== b.esZonaActual) return a.esZonaActual ? -1 : 1;
      const an = (a.nombre ?? a.username ?? '').localeCompare(b.nombre ?? b.username ?? '', 'es');
      return an;
    });

  return NextResponse.json({
    data: {
      area: { id: current.id, nombre: current.nombre },
      transportes: sortActualFirst([...transportesById.values()]),
      celadoras: sortActualFirst([...celadorasById.values()]),
      pasajeros: sortActualFirst([...pasajerosById.values()]),
      destinos: sortActualFirst([...destinosById.values()]),
      choferes: sortActualFirst([...choferesById.values()]),
    },
  });
}
