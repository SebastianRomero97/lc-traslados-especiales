import { NextResponse } from 'next/server';
import { requireAdministracionApi } from '@/lib/administracion-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { parseFechaDay } from '@/lib/grilla-conflict';
import { todayFechaInput } from '@/lib/grilla.utils';
import { buildPresenciaDia } from '@/lib/presencia-dia';
import { isEstadoPresencia } from '@/lib/presencia-dia.utils';

export async function GET(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  try {
    const fecha = new URL(request.url).searchParams.get('fecha') ?? undefined;
    const data = await buildPresenciaDia(fecha);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API /administracion/presencia-dia GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cargar la presencia del día.') },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdministracionApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      fecha?: string;
      pasajeroId?: string | null;
      pasajeroNombre?: string;
      estado?: string;
    };

    const fechaStr = (body.fecha?.trim() || todayFechaInput()).slice(0, 10);
    const fecha = parseFechaDay(fechaStr);
    const pasajeroNombre = body.pasajeroNombre?.trim() || '';
    const pasajeroId = body.pasajeroId?.trim() || null;
    const estadoRaw = body.estado?.trim() || '';

    if (!pasajeroNombre) {
      return NextResponse.json({ message: 'Falta el nombre del pasajero.' }, { status: 400 });
    }
    if (!isEstadoPresencia(estadoRaw)) {
      return NextResponse.json(
        { message: 'Estado inválido. Usá Presente, Ausente o Retirado.' },
        { status: 400 },
      );
    }

    const row = await prisma.presenciaDia.upsert({
      where: {
        fecha_pasajeroNombre: {
          fecha,
          pasajeroNombre,
        },
      },
      create: {
        fecha,
        pasajeroNombre,
        pasajeroId,
        estado: estadoRaw,
        updatedById: auth.user.id,
      },
      update: {
        estado: estadoRaw,
        ...(pasajeroId ? { pasajeroId } : {}),
        updatedById: auth.user.id,
      },
    });

    return NextResponse.json({
      data: row,
      message: `Marcado como ${
        estadoRaw === 'PRESENTE'
          ? 'Presente'
          : estadoRaw === 'RETIRADO'
            ? 'Retirado'
            : 'Ausente'
      }.`,
    });
  } catch (error) {
    console.error('[API /administracion/presencia-dia PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar la presencia.') },
      { status: 500 },
    );
  }
}
