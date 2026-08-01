import { NextResponse } from 'next/server';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import {
  edadDesdeCumpleanos,
  resumenAsistenciasFromRows,
  type AsistenciaEstadoCount,
} from '@/lib/pasajero.utils';

const pasajeroInclude = {
  contactos: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, relacion: true, telefono: true },
  },
  areas: {
    select: {
      area: { select: { id: true, nombre: true, active: true } },
      destinos: {
        select: {
          destino: { select: { id: true, nombre: true, domicilio: true, active: true } },
        },
      },
    },
  },
};

type AsistenciaRow = {
  pasajeroId: string | null;
  pasajeroNombre: string;
  estado: AsistenciaEstadoCount;
};

function serializePasajero(
  p: {
    id: string;
    nombre: string;
    direccion: string;
    dni: string | null;
    fechaCumpleanos: Date | null;
    edad: number | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    contactos: { id: string; relacion: string; telefono: string }[];
    areas: {
      area: { id: string; nombre: string; active: boolean };
      destinos: {
        destino: { id: string; nombre: string; domicilio: string; active: boolean };
      }[];
    }[];
  },
  asistenciaRows: AsistenciaRow[],
) {
  const nombreKey = p.nombre.trim().toLowerCase();
  const rows = asistenciaRows.filter(
    (r) =>
      r.pasajeroId === p.id ||
      (!r.pasajeroId && r.pasajeroNombre.trim().toLowerCase() === nombreKey),
  );
  const asistencia = resumenAsistenciasFromRows(rows);
  const edadCalculada = edadDesdeCumpleanos(p.fechaCumpleanos);
  const areas = p.areas.map((ap) => ({
    id: ap.area.id,
    nombre: ap.area.nombre,
    active: ap.area.active,
    destinos: ap.destinos.map((d) => d.destino),
  }));

  return {
    ...p,
    edadCalculada,
    edadMostrada: edadCalculada ?? p.edad,
    asistencia,
    areas,
  };
}

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const pasajeros = await prisma.pasajero.findMany({
    orderBy: { nombre: 'asc' },
    include: pasajeroInclude,
  });

  const ids = pasajeros.map((p) => p.id);
  const nombres = pasajeros.map((p) => p.nombre);

  const asistenciaRows =
    ids.length === 0
      ? []
      : await prisma.asistencia.findMany({
          where: {
            OR: [
              { pasajeroId: { in: ids } },
              { AND: [{ pasajeroId: null }, { pasajeroNombre: { in: nombres } }] },
            ],
          },
          select: { pasajeroId: true, pasajeroNombre: true, estado: true },
        });

  return NextResponse.json({
    data: pasajeros.map((p) => serializePasajero(p, asistenciaRows)),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      direccion?: string;
    };

    const nombre = body.nombre?.trim();
    const direccion = body.direccion?.trim();

    const missing = missingFieldsMessage(
      { nombre, direccion },
      { nombre: 'nombre del pasajero', direccion: 'dirección' },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    const pasajero = await prisma.pasajero.create({
      data: {
        nombre: nombre!,
        direccion: direccion!,
        active: true,
      },
      include: pasajeroInclude,
    });

    return NextResponse.json(
      {
        data: serializePasajero(pasajero, []),
        message: 'Pasajero creado.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /admin/pasajeros POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos crear el pasajero.') },
      { status: 500 },
    );
  }
}
