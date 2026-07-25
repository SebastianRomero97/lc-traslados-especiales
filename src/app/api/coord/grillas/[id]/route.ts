import { NextResponse } from 'next/server';
import { describeCaughtError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import {
  buildGrillaTitulo,
  buildGrillaWhatsAppText,
  normalizeAccion,
  type GrillaFilaInput,
} from '@/lib/grilla.utils';

type Params = { params: Promise<{ id: string }> };

const grillaInclude = {
  area: { select: { id: true, nombre: true } },
  transporte: { select: { id: true, nombre: true, tipo: true } },
  chofer: { select: { id: true, username: true } },
  celadora: { select: { id: true, username: true } },
  filas: {
    orderBy: { orden: 'asc' as const },
    include: {
      pasajero: { select: { id: true, nombre: true, direccion: true } },
    },
  },
};

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const grilla = await prisma.grilla.findUnique({
    where: { id },
    include: grillaInclude,
  });

  if (!grilla) {
    return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
  }

  const titulo = buildGrillaTitulo({
    tipoItinerario: grilla.tipoItinerario,
    transporteNombre: grilla.transporte.nombre,
    fecha: grilla.fecha,
  });

  const whatsappText = buildGrillaWhatsAppText({
    titulo,
    tipoTransporte: grilla.transporte.tipo,
    choferNombre: grilla.chofer.username,
    celadoraNombre: grilla.celadora?.username ?? null,
    conCeladora: grilla.conCeladora,
    nota: grilla.nota,
    filas: grilla.filas.map((f) => ({
      hora: f.hora,
      direccion: f.direccion,
      pasajeroNombre: f.pasajeroNombre,
      accion: f.accion,
      trasbordoHacia: f.trasbordoHacia,
    })),
  });

  return NextResponse.json({ data: grilla, titulo, whatsappText });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.grilla.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      nota?: string | null;
      conCeladora?: boolean;
      celadoraId?: string | null;
      filas?: GrillaFilaInput[];
    };

    const conCeladora = body.conCeladora ?? existing.conCeladora;
    const celadoraId =
      body.celadoraId === undefined
        ? existing.celadoraId
        : body.celadoraId?.trim() || null;

    if (conCeladora && !celadoraId) {
      return NextResponse.json(
        { message: 'Si el recorrido es con celadora, seleccioná una celadora.' },
        { status: 400 },
      );
    }

    const grilla = await prisma.$transaction(async (tx) => {
      if (body.filas) {
        if (body.filas.length === 0) {
          throw new Error('EMPTY_FILAS');
        }
        await tx.grillaFila.deleteMany({ where: { grillaId: id } });
        await tx.grillaFila.createMany({
          data: body.filas.map((fila, index) => ({
            grillaId: id,
            orden: index + 1,
            hora: fila.hora.trim(),
            direccion: fila.direccion.trim(),
            pasajeroNombre: fila.pasajeroNombre.trim(),
            pasajeroId: fila.pasajeroId || null,
            destinoId: fila.destinoId || null,
            accion: normalizeAccion(fila.accion),
            trasbordoHacia:
              normalizeAccion(fila.accion) === 'TRASBORDO'
                ? fila.trasbordoHacia?.trim() || null
                : null,
          })),
        });
      }

      return tx.grilla.update({
        where: { id },
        data: {
          nota: body.nota === undefined ? undefined : body.nota?.trim() || null,
          conCeladora,
          celadoraId: conCeladora ? celadoraId : null,
        },
        include: grillaInclude,
      });
    });

    return NextResponse.json({ data: grilla, message: 'Grilla actualizada.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPTY_FILAS') {
      return NextResponse.json(
        { message: 'La grilla debe tener al menos una fila.' },
        { status: 400 },
      );
    }
    console.error('[API /coord/grillas PATCH]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos actualizar la grilla.') }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.grilla.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Grilla no encontrada.' }, { status: 404 });
    }

    await prisma.grilla.delete({ where: { id } });
    return NextResponse.json({ message: 'Grilla eliminada.' });
  } catch (error) {
    console.error('[API /coord/grillas DELETE]', error);
    return NextResponse.json({ message: describeCaughtError(error, 'No pudimos eliminar la grilla.') }, { status: 500 });
  }
}
