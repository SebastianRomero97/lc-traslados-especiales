import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCoordinadoraApi } from '@/lib/coordinadora-auth';
import { describeCaughtError } from '@/lib/api-errors';
import {
  accionPorTipoParada,
  buildDetalleDestino,
  isSalidaItinerario,
  isTipoItinerario,
  modalidadItinerario,
  tiposIngresoParaSalida,
  type TipoItinerario,
} from '@/lib/grilla.utils';

/**
 * Arma una sugerencia de grilla de SALIDAS a partir de quienes
 * asistieron en la grilla de INGRESOS del mismo día/área.
 * Transporte y celadora vienen precargados pero son editables en el form.
 */
export async function GET(request: Request) {
  const auth = await requireCoordinadoraApi();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId')?.trim();
    const fecha = searchParams.get('fecha')?.trim();
    const transporteId = searchParams.get('transporteId')?.trim() || undefined;
    const grillaIngresoId = searchParams.get('grillaIngresoId')?.trim() || undefined;
    const targetTipoRaw = searchParams.get('targetTipo')?.trim() || 'SALIDA';

    if (!areaId || !fecha) {
      return NextResponse.json(
        { message: 'Indicá areaId y fecha.' },
        { status: 400 },
      );
    }

    if (!isTipoItinerario(targetTipoRaw) || !isSalidaItinerario(targetTipoRaw)) {
      return NextResponse.json(
        { message: 'targetTipo debe ser un itinerario de Salida (normal, adaptación o especial).' },
        { status: 400 },
      );
    }
    const targetTipo: TipoItinerario = targetTipoRaw;
    const tiposIngreso = tiposIngresoParaSalida(targetTipo);

    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
    if (Number.isNaN(fechaDate.getTime())) {
      return NextResponse.json({ message: 'Fecha inválida.' }, { status: 400 });
    }

    const ingreso = grillaIngresoId
      ? await prisma.grilla.findFirst({
          where: {
            id: grillaIngresoId,
            areaId,
            tipoItinerario: { in: tiposIngreso },
          },
          include: grillaIngresoInclude,
        })
      : await prisma.grilla.findFirst({
          where: {
            areaId,
            tipoItinerario: { in: tiposIngreso },
            fecha: fechaDate,
            ...(transporteId ? { transporteId } : {}),
          },
          include: grillaIngresoInclude,
          orderBy: { createdAt: 'desc' },
        });

    if (!ingreso) {
      return NextResponse.json(
        {
          message: transporteId
            ? 'No hay grilla de Ingresos ese día para ese transporte.'
            : 'No hay grilla de Ingresos ese día en el área.',
        },
        { status: 404 },
      );
    }

    const asistentes = ingreso.asistencias.filter((a) => a.estado === 'ASISTIO');
    if (asistentes.length === 0) {
      return NextResponse.json(
        {
          message:
            'La grilla de Ingresos no tiene asistencias marcadas como “Asistió”. Completá la asistencia primero.',
        },
        { status: 400 },
      );
    }

    const areaPasajeros = await prisma.areaPasajero.findMany({
      where: { areaId },
      select: {
        pasajeroId: true,
        pasajero: { select: { id: true, nombre: true, direccion: true } },
        destinos: {
          include: {
            destino: { select: { id: true, nombre: true, domicilio: true, active: true } },
          },
        },
      },
    });
    const asignacionByPasajeroId = new Map(
      areaPasajeros.map((ap) => [ap.pasajeroId, ap]),
    );

    type AsistenteInfo = {
      pasajeroId: string | null;
      pasajeroNombre: string;
      direccion: string;
      destinoId: string | null;
      destinoNombre: string | null;
      destinoDomicilio: string | null;
      horaIngreso: string;
    };

    const asistenteInfos: AsistenteInfo[] = asistentes.map((a) => {
      const filaIngreso = ingreso.filas.find(
        (f) =>
          (a.pasajeroId && f.pasajeroId === a.pasajeroId) ||
          f.pasajeroNombre.toLowerCase() === a.pasajeroNombre.toLowerCase(),
      );
      const asignacion = a.pasajeroId
        ? asignacionByPasajeroId.get(a.pasajeroId)
        : undefined;
      const destino =
        asignacion?.destinos.find((d) => d.destino.active)?.destino ?? null;

      return {
        pasajeroId: a.pasajeroId,
        pasajeroNombre: a.pasajeroNombre,
        direccion:
          asignacion?.pasajero.direccion ??
          filaIngreso?.direccion ??
          a.pasajero?.direccion ??
          '',
        destinoId: destino?.id ?? null,
        destinoNombre: destino?.nombre ?? null,
        destinoDomicilio: destino?.domicilio ?? null,
        horaIngreso: filaIngreso?.hora ?? '',
      };
    });

    const accionDestino = accionPorTipoParada('destino', targetTipo);
    const accionPasajero = accionPorTipoParada('pasajero', targetTipo);

    const destinosOrden: {
      id: string;
      nombre: string;
      domicilio: string;
      nombres: string[];
    }[] = [];
    const destinoIndex = new Map<string, number>();

    for (const info of asistenteInfos) {
      if (!info.destinoId || !info.destinoNombre || !info.destinoDomicilio) continue;
      const existing = destinoIndex.get(info.destinoId);
      if (existing === undefined) {
        destinoIndex.set(info.destinoId, destinosOrden.length);
        destinosOrden.push({
          id: info.destinoId,
          nombre: info.destinoNombre,
          domicilio: info.destinoDomicilio,
          nombres: [info.pasajeroNombre],
        });
      } else {
        destinosOrden[existing].nombres.push(info.pasajeroNombre);
      }
    }

    const filas: {
      tipoParada: 'pasajero' | 'destino';
      hora: string;
      direccion: string;
      pasajeroNombre: string;
      pasajeroId: string | null;
      destinoId: string | null;
      accion: 'SUBE' | 'BAJA';
      trasbordoHacia: string | null;
    }[] = [];

    // Salidas: primero destinos (suben), luego domicilios (bajan).
    for (const dest of destinosOrden) {
      filas.push({
        tipoParada: 'destino',
        hora: '',
        direccion: dest.domicilio,
        pasajeroNombre: buildDetalleDestino({
          destinoNombre: dest.nombre,
          accion: accionDestino,
          pasajeroNombres: dest.nombres,
        }),
        pasajeroId: null,
        destinoId: dest.id,
        accion: accionDestino as 'SUBE' | 'BAJA',
        trasbordoHacia: null,
      });
    }

    for (const info of asistenteInfos) {
      filas.push({
        tipoParada: 'pasajero',
        hora: info.horaIngreso,
        direccion: info.direccion,
        pasajeroNombre: info.pasajeroNombre,
        pasajeroId: info.pasajeroId,
        destinoId: null,
        accion: accionPasajero as 'SUBE' | 'BAJA',
        trasbordoHacia: null,
      });
    }

    return NextResponse.json({
      data: {
        sourceGrilla: {
          id: ingreso.id,
          fecha: ingreso.fecha,
          transporte: ingreso.transporte,
          chofer: ingreso.chofer,
          celadora: ingreso.celadora,
          conCeladora: ingreso.conCeladora,
        },
        asistentesCount: asistentes.length,
        sugerido: {
          tipoItinerario: targetTipo,
          fecha,
          nota: ingreso.nota,
          conCeladora: ingreso.conCeladora,
          transporteId: ingreso.transporteId,
          choferId: ingreso.choferId,
          celadoraId: ingreso.celadoraId,
          filas,
        },
      },
      message: `Salida (${modalidadItinerario(targetTipo) === 'NORMAL' ? 'habitual' : modalidadItinerario(targetTipo) === 'ADAPTACION' ? 'adaptación' : 'especial'}) armada con ${asistentes.length} asistente(s) del Ingreso. Revisá transporte/celadora y horarios.`,
    });
  } catch (error) {
    console.error('[API /coord/grillas/desde-ingreso GET]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(
          error,
          'No pudimos armar la Salida desde el Ingreso.',
        ),
      },
      { status: 500 },
    );
  }
}

const grillaIngresoInclude = {
  asistencias: {
    include: {
      pasajero: { select: { id: true, nombre: true, direccion: true } },
    },
  },
  filas: { orderBy: { orden: 'asc' as const } },
  transporte: { select: { id: true, nombre: true, tipo: true } },
  chofer: { select: { id: true, username: true } },
  celadora: { select: { id: true, username: true } },
} as const;
