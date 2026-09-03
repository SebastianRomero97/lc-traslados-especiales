import { NextResponse } from 'next/server';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { parseFechaDay } from '@/lib/grilla-conflict';
import { todayFechaInput } from '@/lib/grilla.utils';

/**
 * Reserva / libera “en grilla” al armar una salida en el tablero
 * (sin esperar a guardar la grilla).
 */
export async function POST(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      fecha?: string;
      pasajeroId?: string;
      pasajeroNombre?: string;
      sourceKey?: string;
      enGrilla?: boolean;
    };

    const fechaStr = (body.fecha?.trim() || todayFechaInput()).slice(0, 10);
    const fecha = parseFechaDay(fechaStr);
    const pasajeroId = body.pasajeroId?.trim() || '';
    const pasajeroNombre = body.pasajeroNombre?.trim() || '';
    const sourceKey = body.sourceKey?.trim() || '';
    const enGrilla = Boolean(body.enGrilla);

    if (!pasajeroId) {
      return NextResponse.json({ message: 'Falta pasajeroId.' }, { status: 400 });
    }
    if (!sourceKey) {
      return NextResponse.json({ message: 'Falta sourceKey.' }, { status: 400 });
    }

    if (!enGrilla) {
      await prisma.presenciaEnGrillaReserva.deleteMany({
        where: { fecha, pasajeroId, sourceKey },
      });
      return NextResponse.json({ data: { enGrilla: false }, message: 'Reserva liberada.' });
    }

    const row = await prisma.presenciaEnGrillaReserva.upsert({
      where: {
        fecha_pasajeroId: { fecha, pasajeroId },
      },
      create: {
        fecha,
        pasajeroId,
        pasajeroNombre: pasajeroNombre || 'Pasajero',
        sourceKey,
      },
      update: {
        pasajeroNombre: pasajeroNombre || 'Pasajero',
        sourceKey,
      },
    });

    return NextResponse.json({ data: row, message: 'Marcado en grilla.' });
  } catch (error) {
    console.error('[API /administracion/presencia-dia/en-grilla POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar la reserva en grilla.') },
      { status: 500 },
    );
  }
}

/** Libera todas las reservas de un tablero (cancelar / descartar). */
export async function DELETE(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const sourceKey = url.searchParams.get('sourceKey')?.trim() || '';
    const fechaStr = (url.searchParams.get('fecha')?.trim() || todayFechaInput()).slice(0, 10);
    if (!sourceKey) {
      return NextResponse.json({ message: 'Falta sourceKey.' }, { status: 400 });
    }
    const fecha = parseFechaDay(fechaStr);
    const result = await prisma.presenciaEnGrillaReserva.deleteMany({
      where: { fecha, sourceKey },
    });
    return NextResponse.json({
      data: { count: result.count },
      message: 'Reservas liberadas.',
    });
  } catch (error) {
    console.error('[API /administracion/presencia-dia/en-grilla DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos liberar las reservas.') },
      { status: 500 },
    );
  }
}
