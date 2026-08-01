import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { estadoVtvFromFecha, parseOptionalDateInput } from '@/lib/transporte.utils';

type Params = { params: Promise<{ id: string }> };

const transporteInclude = {
  choferes: {
    where: { roles: { has: 'CHOFER' as const } },
    select: { id: true, username: true },
  },
  novedades: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
    select: {
      id: true,
      mensaje: true,
      estado: true,
      detalleAdmin: true,
      createdAt: true,
      updatedAt: true,
      reportadoPor: { select: { id: true, username: true } },
    },
  },
};

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      tipo?: string;
      capacidad?: number | string | null;
      anio?: number | string | null;
      patente?: string | null;
      servicePendiente?: string | null;
      serviceFecha?: string | null;
      vtvVenceAt?: string | null;
      active?: boolean;
    };

    const existing = await prisma.transporte.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Transporte no encontrado.' }, { status: 404 });
    }

    const data: {
      nombre?: string;
      tipo?: string;
      capacidad?: number | null;
      anio?: number | null;
      patente?: string | null;
      servicePendiente?: string | null;
      serviceFecha?: Date | null;
      vtvVenceAt?: Date | null;
      active?: boolean;
    } = {};

    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.tipo === 'string') data.tipo = body.tipo.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    if (body.capacidad !== undefined) {
      if (body.capacidad === '' || body.capacidad === null) {
        data.capacidad = null;
      } else {
        const capacidad = Number(body.capacidad);
        if (Number.isNaN(capacidad) || capacidad < 1) {
          return NextResponse.json(
            { message: 'La capacidad debe ser un número mayor a 0.' },
            { status: 400 },
          );
        }
        data.capacidad = capacidad;
      }
    }

    if (body.anio !== undefined) {
      if (body.anio === '' || body.anio === null) {
        data.anio = null;
      } else {
        const anio = Number(body.anio);
        const yearNow = new Date().getFullYear() + 1;
        if (Number.isNaN(anio) || anio < 1980 || anio > yearNow) {
          return NextResponse.json(
            { message: `El año debe estar entre 1980 y ${yearNow}.` },
            { status: 400 },
          );
        }
        data.anio = anio;
      }
    }

    if (body.patente !== undefined) {
      data.patente =
        body.patente === null || body.patente === ''
          ? null
          : String(body.patente).trim().toUpperCase();
    }

    if (body.servicePendiente !== undefined) {
      data.servicePendiente =
        body.servicePendiente === null || body.servicePendiente === ''
          ? null
          : String(body.servicePendiente).trim();
    }

    if (body.serviceFecha !== undefined) {
      const parsed = parseOptionalDateInput(body.serviceFecha);
      if (parsed === undefined) {
        return NextResponse.json(
          { message: 'Fecha de service inválida.' },
          { status: 400 },
        );
      }
      data.serviceFecha = parsed;
    }

    if (body.vtvVenceAt !== undefined) {
      const parsed = parseOptionalDateInput(body.vtvVenceAt);
      if (parsed === undefined) {
        return NextResponse.json(
          { message: 'Fecha de VTV inválida.' },
          { status: 400 },
        );
      }
      data.vtvVenceAt = parsed;
    }

    const transporte = await prisma.transporte.update({
      where: { id },
      data,
      include: transporteInclude,
    });

    return NextResponse.json({
      data: { ...transporte, vtvEstado: estadoVtvFromFecha(transporte.vtvVenceAt) },
      message: 'Ficha del transporte actualizada.',
    });
  } catch (error) {
    console.error('[API /admin/transportes PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el transporte.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.transporte.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Transporte no encontrado.' }, { status: 404 });
    }

    await prisma.transporte.delete({ where: { id } });
    return NextResponse.json({ message: 'Transporte eliminado.' });
  } catch (error) {
    console.error('[API /admin/transportes DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar el transporte.') },
      { status: 500 },
    );
  }
}
