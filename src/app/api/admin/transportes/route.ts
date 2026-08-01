import { NextResponse } from 'next/server';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { estadoVtvFromFecha } from '@/lib/transporte.utils';

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

function withVtvEstado<T extends { vtvVenceAt: Date | null }>(t: T) {
  return { ...t, vtvEstado: estadoVtvFromFecha(t.vtvVenceAt) };
}

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const transportes = await prisma.transporte.findMany({
    orderBy: { nombre: 'asc' },
    include: transporteInclude,
  });

  return NextResponse.json({ data: transportes.map(withVtvEstado) });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      tipo?: string;
      capacidad?: number | string | null;
    };

    const nombre = body.nombre?.trim();
    const tipo = body.tipo?.trim();
    const capacidadRaw = body.capacidad;
    const capacidad =
      capacidadRaw === '' || capacidadRaw === null || capacidadRaw === undefined
        ? null
        : Number(capacidadRaw);

    const missing = missingFieldsMessage(
      { nombre, tipo },
      { nombre: 'nombre del transporte', tipo: 'tipo' },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    if (capacidad !== null && (Number.isNaN(capacidad) || capacidad < 1)) {
      return NextResponse.json(
        { message: 'La capacidad debe ser un número mayor a 0.' },
        { status: 400 },
      );
    }

    const transporte = await prisma.transporte.create({
      data: {
        nombre: nombre!,
        tipo: tipo!,
        capacidad,
        active: true,
      },
      include: transporteInclude,
    });

    return NextResponse.json(
      {
        data: withVtvEstado(transporte),
        message: 'Transporte creado. Completá la ficha cuando quieras.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /admin/transportes POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos crear el transporte.') },
      { status: 500 },
    );
  }
}
