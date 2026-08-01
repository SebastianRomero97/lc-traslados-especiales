import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';
import { estadoVtvFromFecha } from '@/lib/transporte.utils';
import { parseFechaDay } from '@/lib/grilla-conflict';
import { todayFechaInput } from '@/lib/grilla.utils';

const transporteSelect = {
  id: true,
  nombre: true,
  tipo: true,
  capacidad: true,
  anio: true,
  patente: true,
  servicePendiente: true,
  serviceFecha: true,
  vtvVenceAt: true,
  active: true,
} as const;

/** Vehículo asignado al chofer (o de la grilla del día si es prestador) + novedades. */
export async function GET() {
  const auth = await requireOperativoApi(['CHOFER']);
  if ('error' in auth) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      isPrestador: true,
      transporteId: true,
      transporte: { select: transporteSelect },
    },
  });

  let transporte = user?.transporte ?? null;
  let fuente: 'asignado' | 'grilla' | null = transporte ? 'asignado' : null;

  // Prestador sin vehículo de empresa: mostrar el de la grilla operativa del día.
  if (!transporte && user?.isPrestador) {
    const hoy = parseFechaDay(todayFechaInput());
    const manana = new Date(hoy);
    manana.setUTCDate(manana.getUTCDate() + 1);

    const grillaHoy = await prisma.grilla.findFirst({
      where: {
        choferId: auth.user.id,
        fecha: { gte: hoy, lt: manana },
        estado: { in: ['APROBADA', 'EN_CURSO', 'FINALIZADA'] },
      },
      orderBy: { updatedAt: 'desc' },
      select: { transporte: { select: transporteSelect } },
    });
    if (grillaHoy?.transporte) {
      transporte = grillaHoy.transporte;
      fuente = 'grilla';
    }
  }

  if (!transporte) {
    return NextResponse.json({
      data: {
        transporte: null,
        novedades: [],
        isPrestador: Boolean(user?.isPrestador),
        fuente: null,
      },
    });
  }

  const novedades = await prisma.novedadVehiculo.findMany({
    where: {
      transporteId: transporte.id,
      reportadoPorId: auth.user.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      mensaje: true,
      estado: true,
      detalleAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    data: {
      transporte: {
        ...transporte,
        vtvEstado: estadoVtvFromFecha(transporte.vtvVenceAt),
      },
      novedades,
      isPrestador: Boolean(user?.isPrestador),
      fuente,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireOperativoApi(['CHOFER']);
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as { mensaje?: string };
    const mensaje = body.mensaje?.trim() ?? '';
    if (mensaje.length < 5) {
      return NextResponse.json(
        { message: 'Escribí la novedad (mínimo 5 caracteres).' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { transporteId: true, isPrestador: true },
    });

    let transporteId = user?.transporteId ?? null;

    if (!transporteId && user?.isPrestador) {
      const hoy = parseFechaDay(todayFechaInput());
      const manana = new Date(hoy);
      manana.setUTCDate(manana.getUTCDate() + 1);
      const grillaHoy = await prisma.grilla.findFirst({
        where: {
          choferId: auth.user.id,
          fecha: { gte: hoy, lt: manana },
          estado: { in: ['APROBADA', 'EN_CURSO', 'FINALIZADA'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { transporteId: true },
      });
      transporteId = grillaHoy?.transporteId ?? null;
    }

    if (!transporteId) {
      return NextResponse.json(
        {
          message: user?.isPrestador
            ? 'No hay vehículo de grilla para hoy. Cuando te asignen un recorrido, vas a poder reportar novedades.'
            : 'No tenés un vehículo asignado. Pedile al Admin que te asigne uno.',
        },
        { status: 400 },
      );
    }

    const novedad = await prisma.novedadVehiculo.create({
      data: {
        mensaje,
        transporteId,
        reportadoPorId: auth.user.id,
        estado: 'PENDIENTE_REVISION',
      },
      select: {
        id: true,
        mensaje: true,
        estado: true,
        detalleAdmin: true,
        createdAt: true,
        updatedAt: true,
        transporte: { select: { id: true, nombre: true, tipo: true } },
        reportadoPor: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json(
      {
        data: novedad,
        message: 'Novedad enviada. Quedó registrada en la ficha del vehículo.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /operativo/vehiculo POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos guardar la novedad.') },
      { status: 500 },
    );
  }
}
