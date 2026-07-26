import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { requireOperativoApi } from '@/lib/operativo-auth';
import {
  canAccessAsCeladora,
  canAccessAsChofer,
  findGrillaOperativa,
} from '@/lib/operativo-grilla';
import {
  composeInformeChofer,
  type NivelCombustible,
} from '@/lib/operativo.utils';
import { hasRole } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const NIVELES: NivelCombustible[] = ['VACIO', 'CUARTO', 'MEDIO', 'TRES_CUARTOS', 'LLENO'];

const CIERRE_MSG = 'Jornada Completada Exitosamente, Gracias por tu compromiso con LC';

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireOperativoApi(['CELADORA', 'CHOFER']);
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      rol?: 'CELADORA' | 'CHOFER';
      informe?: string;
      informeChoferCeladora?: string;
      informeChoferVehiculo?: string;
      combustibleNivel?: string;
    };

    if (body.rol !== 'CELADORA' && body.rol !== 'CHOFER') {
      return NextResponse.json({ message: 'Indicá el rol.' }, { status: 400 });
    }
    if (!hasRole(auth.user, body.rol)) {
      return NextResponse.json({ message: 'No tenés ese rol.' }, { status: 403 });
    }

    const grilla = await findGrillaOperativa(id);
    if (!grilla) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    if (body.rol === 'CELADORA') {
      if (!canAccessAsCeladora(grilla, auth.user.id)) {
        return NextResponse.json({ message: 'No sos la celadora de esta grilla.' }, { status: 403 });
      }
      if (!grilla.celadoraFinAt) {
        return NextResponse.json(
          { message: 'Finalizá el recorrido antes de cargar el informe.' },
          { status: 400 },
        );
      }
      if (grilla.informeCeladora) {
        return NextResponse.json(
          { message: 'Esta jornada ya fue cerrada. No se puede modificar el informe.' },
          { status: 400 },
        );
      }

      const informe = body.informe?.trim() ?? '';
      if (!informe) {
        return NextResponse.json(
          { message: 'Escribí las observaciones del informe.' },
          { status: 400 },
        );
      }

      const updated = await prisma.grilla.update({
        where: { id },
        data: { informeCeladora: informe },
        select: {
          id: true,
          informeCeladora: true,
          informeChofer: true,
          informeChoferCeladora: true,
          informeChoferVehiculo: true,
          combustibleNivel: true,
        },
      });
      return NextResponse.json({
        data: updated,
        message: CIERRE_MSG,
        jornadaCerrada: true,
      });
    }

    if (!canAccessAsChofer(grilla, auth.user.id)) {
      return NextResponse.json({ message: 'No sos el chofer de esta grilla.' }, { status: 403 });
    }
    if (!grilla.choferFinAt) {
      return NextResponse.json(
        { message: 'Finalizá el manejo antes de cargar el informe.' },
        { status: 400 },
      );
    }
    if (grilla.informeChofer || grilla.combustibleNivel) {
      return NextResponse.json(
        { message: 'Esta jornada ya fue cerrada. No se puede modificar el informe.' },
        { status: 400 },
      );
    }

    const obsCeladora = body.informeChoferCeladora?.trim() ?? '';
    const obsVehiculo = body.informeChoferVehiculo?.trim() ?? '';
    const combustible = body.combustibleNivel as NivelCombustible | undefined;

    if (grilla.conCeladora && !obsCeladora) {
      return NextResponse.json(
        { message: 'Completá la observación sobre la celadora.' },
        { status: 400 },
      );
    }
    if (!obsVehiculo) {
      return NextResponse.json(
        { message: 'Completá la observación sobre el vehículo.' },
        { status: 400 },
      );
    }
    if (!combustible || !NIVELES.includes(combustible)) {
      return NextResponse.json(
        { message: 'Seleccioná el nivel de combustible del vehículo.' },
        { status: 400 },
      );
    }

    const informeTexto = composeInformeChofer({
      conCeladora: grilla.conCeladora,
      obsCeladora: grilla.conCeladora ? obsCeladora : null,
      obsVehiculo,
      combustible,
    });

    const updated = await prisma.grilla.update({
      where: { id },
      data: {
        informeChofer: informeTexto,
        informeChoferCeladora: grilla.conCeladora ? obsCeladora : null,
        informeChoferVehiculo: obsVehiculo,
        combustibleNivel: combustible,
      },
      select: {
        id: true,
        informeCeladora: true,
        informeChofer: true,
        informeChoferCeladora: true,
        informeChoferVehiculo: true,
        combustibleNivel: true,
      },
    });

    return NextResponse.json({
      data: updated,
      message: CIERRE_MSG,
      jornadaCerrada: true,
    });
  } catch (error) {
    console.error('[API /operativo/grillas informe]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos guardar el informe.') },
      { status: 500 },
    );
  }
}
