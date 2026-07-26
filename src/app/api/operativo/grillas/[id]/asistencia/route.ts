import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';
import { canMarkAsistencia, findGrillaOperativa } from '@/lib/operativo-grilla';
import type { EstadoAsistencia } from '@/lib/operativo.utils';
import { hasRole } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const ESTADOS: EstadoAsistencia[] = ['ASISTIO', 'CANCELO', 'NO_SE_PRESENTO'];

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireOperativoApi(['CELADORA', 'CHOFER']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      rol?: 'CELADORA' | 'CHOFER';
      pasajeroNombre?: string;
      pasajeroId?: string | null;
      estado?: string;
      motivoCancelacion?: string | null;
    };

    if (body.rol !== 'CELADORA' && body.rol !== 'CHOFER') {
      return NextResponse.json({ message: 'Indicá el rol.' }, { status: 400 });
    }
    if (!hasRole(auth.user, body.rol)) {
      return NextResponse.json({ message: 'No tenés ese rol.' }, { status: 403 });
    }

    const nombre = body.pasajeroNombre?.trim();
    if (!nombre) {
      return NextResponse.json({ message: 'Falta el nombre del pasajero.' }, { status: 400 });
    }
    if (!body.estado || !ESTADOS.includes(body.estado as EstadoAsistencia)) {
      return NextResponse.json({ message: 'Estado de asistencia no válido.' }, { status: 400 });
    }

    const estado = body.estado as EstadoAsistencia;
    const motivo =
      estado === 'CANCELO' ? body.motivoCancelacion?.trim() || null : null;

    const grilla = await findGrillaOperativa(id);
    if (!grilla) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }
    if (!canMarkAsistencia(grilla, auth.user.id, body.rol)) {
      return NextResponse.json(
        {
          message: grilla.conCeladora
            ? 'En este recorrido la asistencia la registra la celadora.'
            : 'No podés registrar asistencia en esta grilla.',
        },
        { status: 403 },
      );
    }

    const jornadaCerrada =
      body.rol === 'CELADORA' ? Boolean(grilla.informeCeladora) : Boolean(grilla.informeChofer);
    if (jornadaCerrada) {
      return NextResponse.json(
        {
          message:
            'Esta jornada ya fue cerrada. No se pueden modificar asistencias ni destinos.',
        },
        { status: 400 },
      );
    }

    const finAt = body.rol === 'CELADORA' ? grilla.celadoraFinAt : grilla.choferFinAt;
    if (finAt) {
      return NextResponse.json(
        {
          message:
            'El recorrido ya fue finalizado. Solo falta el informe para cerrar la jornada.',
        },
        { status: 400 },
      );
    }

    const asistencia = await prisma.asistencia.upsert({
      where: {
        grillaId_pasajeroNombre: {
          grillaId: id,
          pasajeroNombre: nombre,
        },
      },
      create: {
        grillaId: id,
        pasajeroNombre: nombre,
        pasajeroId: body.pasajeroId || null,
        estado,
        motivoCancelacion: motivo,
        registradoPorId: auth.user.id,
      },
      update: {
        estado,
        motivoCancelacion: motivo,
        pasajeroId: body.pasajeroId || undefined,
        registradoPorId: auth.user.id,
      },
    });

    return NextResponse.json({
      data: asistencia,
      message: 'Asistencia guardada.',
    });
  } catch (error) {
    console.error('[API /operativo/grillas asistencia]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos guardar la asistencia.') },
      { status: 500 },
    );
  }
}
