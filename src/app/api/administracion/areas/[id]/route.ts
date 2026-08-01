import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  const area = await prisma.area.findUnique({
    where: { id },
    include: {
      destinos: { orderBy: { nombre: 'asc' } },
      celadoras: {
        include: {
          user: { select: { id: true, username: true, active: true, roles: true } },
        },
      },
      choferes: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              active: true,
              isPrestador: true,
              transporteId: true,
            },
          },
        },
      },
      transportes: {
        include: {
          transporte: {
            include: {
              celadoras: {
                include: {
                  user: { select: { id: true, username: true, active: true } },
                },
              },
              choferes: { select: { id: true, username: true, active: true } },
            },
          },
        },
      },
      pasajeros: {
        include: {
          pasajero: true,
          destinos: {
            include: {
              destino: { select: { id: true, nombre: true, domicilio: true, active: true } },
            },
          },
        },
      },
    },
  });

  if (!area) {
    return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
  }

  const areaPayload = {
    ...area,
    pasajeros: area.pasajeros.map((p) => ({
      pasajero: p.pasajero,
      destinoIds: p.destinos.map((d) => d.destinoId),
      destinos: p.destinos.map((d) => d.destino).filter((d) => d.active),
    })),
  };

  const [celadorasDisponibles, transportesDisponibles, pasajerosDisponibles] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { has: 'CELADORA' }, active: true },
      orderBy: { username: 'asc' },
      select: { id: true, username: true },
    }),
    prisma.transporte.findMany({
      where: { active: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tipo: true },
    }),
    prisma.pasajero.findMany({
      where: { active: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, direccion: true },
    }),
  ]);

  return NextResponse.json({
    data: {
      area: areaPayload,
      options: {
        celadoras: celadorasDisponibles,
        transportes: transportesDisponibles,
        pasajeros: pasajerosDisponibles,
      },
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as { nombre?: string; active?: boolean };
    const existing = await prisma.area.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
    }

    const data: { nombre?: string; active?: boolean } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    const area = await prisma.area.update({ where: { id }, data });
    return NextResponse.json({ data: area, message: 'Área actualizada.' });
  } catch (error) {
    console.error('[API /administracion/areas PATCH]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar el área.') }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.area.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
    }

    await prisma.area.delete({ where: { id } });
    return NextResponse.json({ message: 'Área eliminada.' });
  } catch (error) {
    console.error('[API /administracion/areas DELETE]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos eliminar el área.') }, { status: 500 });
  }
}
