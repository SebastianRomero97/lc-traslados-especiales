import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';

type Params = { params: Promise<{ id: string }> };

/** Historial completo de un pasajero para el panel Admin. */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const pasajero = await prisma.pasajero.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        direccion: true,
        active: true,
        createdAt: true,
        areas: {
          select: {
            destino: { select: { id: true, nombre: true, domicilio: true, active: true } },
            area: {
              select: { id: true, nombre: true, active: true },
            },
          },
        },
      },
    });

    if (!pasajero) {
      return NextResponse.json({ message: 'Pasajero no encontrado.' }, { status: 404 });
    }

    const [asistencias, filasGrilla] = await Promise.all([
      prisma.asistencia.findMany({
        where: {
          OR: [
            { pasajeroId: id },
            { pasajeroNombre: { equals: pasajero.nombre, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          estado: true,
          motivoCancelacion: true,
          grilla: {
            select: {
              id: true,
              fecha: true,
              tipoItinerario: true,
              nota: true,
              area: { select: { nombre: true } },
              transporte: {
                select: { id: true, nombre: true, tipo: true, active: true },
              },
              chofer: { select: { username: true } },
              celadora: { select: { username: true } },
              filas: {
                orderBy: { orden: 'asc' },
                select: {
                  id: true,
                  hora: true,
                  direccion: true,
                  pasajeroNombre: true,
                  pasajeroId: true,
                  accion: true,
                  trasbordoHacia: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.grillaFila.findMany({
        where: {
          OR: [
            { pasajeroId: id },
            { pasajeroNombre: { equals: pasajero.nombre, mode: 'insensitive' } },
          ],
        },
        select: {
          grilla: {
            select: {
              id: true,
              area: { select: { nombre: true } },
              transporte: {
                select: { id: true, nombre: true, tipo: true, active: true },
              },
            },
          },
        },
      }),
    ]);

    const seenAsistencia = new Set<string>();
    const unique = asistencias.filter((a) => {
      if (seenAsistencia.has(a.id)) return false;
      seenAsistencia.add(a.id);
      return true;
    });

    let asistio = 0;
    let cancelo = 0;
    let noSePresento = 0;
    const faltasDetalle: {
      id: string;
      estado: 'CANCELO' | 'NO_SE_PRESENTO';
      motivoCancelacion: string | null;
      fecha: string;
      tipoItinerario: string;
      area: string;
      transporte: string;
      responsables: string;
    }[] = [];
    const registros: {
      id: string;
      estado: 'ASISTIO' | 'CANCELO' | 'NO_SE_PRESENTO';
      motivoCancelacion: string | null;
      grilla: {
        id: string;
        fecha: string;
        tipoItinerario: string;
        nota: string | null;
        area: string;
        transporte: string;
        tipoTransporte: string;
        responsables: string;
        filas: {
          id: string;
          hora: string;
          direccion: string;
          pasajeroNombre: string;
          pasajeroId: string | null;
          accion: string;
          trasbordoHacia: string | null;
        }[];
      };
    }[] = [];

    for (const a of unique) {
      const responsables = a.grilla.celadora
        ? `${a.grilla.chofer.username} + ${a.grilla.celadora.username}`
        : a.grilla.chofer.username;

      registros.push({
        id: a.id,
        estado: a.estado,
        motivoCancelacion: a.motivoCancelacion,
        grilla: {
          id: a.grilla.id,
          fecha: a.grilla.fecha.toISOString(),
          tipoItinerario: a.grilla.tipoItinerario,
          nota: a.grilla.nota,
          area: a.grilla.area.nombre,
          transporte: a.grilla.transporte.nombre,
          tipoTransporte: a.grilla.transporte.tipo,
          responsables,
          filas: a.grilla.filas,
        },
      });

      if (a.estado === 'ASISTIO') {
        asistio += 1;
      } else if (a.estado === 'CANCELO') {
        cancelo += 1;
        faltasDetalle.push({
          id: a.id,
          estado: 'CANCELO',
          motivoCancelacion: a.motivoCancelacion,
          fecha: a.grilla.fecha.toISOString(),
          tipoItinerario: a.grilla.tipoItinerario,
          area: a.grilla.area.nombre,
          transporte: a.grilla.transporte.nombre,
          responsables,
        });
      } else {
        noSePresento += 1;
        faltasDetalle.push({
          id: a.id,
          estado: 'NO_SE_PRESENTO',
          motivoCancelacion: a.motivoCancelacion,
          fecha: a.grilla.fecha.toISOString(),
          tipoItinerario: a.grilla.tipoItinerario,
          area: a.grilla.area.nombre,
          transporte: a.grilla.transporte.nombre,
          responsables,
        });
      }
    }

    const areas = pasajero.areas.map((ap) => ({
      id: ap.area.id,
      nombre: ap.area.nombre,
      active: ap.area.active,
      destino: ap.destino
        ? {
            id: ap.destino.id,
            nombre: ap.destino.nombre,
            domicilio: ap.destino.domicilio,
            active: ap.destino.active,
          }
        : null,
    }));

    /** Solo vehículos donde el pasajero figuró en una grilla (no todos los del área). */
    const transportesMap = new Map<
      string,
      {
        id: string;
        nombre: string;
        tipo: string;
        active: boolean;
        areas: string[];
        viajes: number;
        grillaIds: Set<string>;
      }
    >();

    const registerTransporte = (g: {
      id: string;
      area: { nombre: string };
      transporte: { id: string; nombre: string; tipo: string; active: boolean };
    }) => {
      const t = g.transporte;
      const existing = transportesMap.get(t.id);
      if (existing) {
        if (!existing.areas.includes(g.area.nombre)) {
          existing.areas.push(g.area.nombre);
        }
        if (!existing.grillaIds.has(g.id)) {
          existing.grillaIds.add(g.id);
          existing.viajes += 1;
        }
        return;
      }
      transportesMap.set(t.id, {
        id: t.id,
        nombre: t.nombre,
        tipo: t.tipo,
        active: t.active,
        areas: [g.area.nombre],
        viajes: 1,
        grillaIds: new Set([g.id]),
      });
    };

    for (const fila of filasGrilla) {
      registerTransporte(fila.grilla);
    }
    for (const a of unique) {
      registerTransporte(a.grilla);
    }

    return NextResponse.json({
      data: {
        pasajero: {
          id: pasajero.id,
          nombre: pasajero.nombre,
          direccion: pasajero.direccion,
          active: pasajero.active,
          createdAt: pasajero.createdAt,
        },
        areas,
        transportes: [...transportesMap.values()]
          .map(({ grillaIds: _ids, ...rest }) => rest)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        resumen: {
          totalRegistros: unique.length,
          asistio,
          faltas: cancelo + noSePresento,
          cancelo,
          noSePresento,
        },
        faltasDetalle,
        registros,
        grafica: [
          { label: 'Asistencias', value: asistio },
          { label: 'Faltas', value: cancelo + noSePresento },
        ],
      },
    });
  } catch (error) {
    console.error('[API /admin/pasajeros/[id]/historial GET]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos cargar el historial.') },
      { status: 500 },
    );
  }
}
