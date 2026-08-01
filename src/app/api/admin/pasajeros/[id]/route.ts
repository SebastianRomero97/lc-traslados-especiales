import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { parseOptionalDateInput } from '@/lib/transporte.utils';
import {
  edadDesdeCumpleanos,
  resumenAsistenciasFromRows,
  type AsistenciaEstadoCount,
} from '@/lib/pasajero.utils';

type Params = { params: Promise<{ id: string }> };

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

type ContactoInput = { relacion?: string; telefono?: string };

function parseContactos(raw: unknown): { relacion: string; telefono: string }[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: { relacion: string; telefono: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const relacion = String((item as ContactoInput).relacion ?? '').trim();
    const telefono = String((item as ContactoInput).telefono ?? '').trim();
    if (!relacion && !telefono) continue;
    if (!relacion || !telefono) return undefined;
    out.push({ relacion, telefono });
  }
  return out;
}

async function loadSerialized(id: string) {
  const pasajero = await prisma.pasajero.findUnique({
    where: { id },
    include: pasajeroInclude,
  });
  if (!pasajero) return null;

  const asistenciaRows = await prisma.asistencia.findMany({
    where: {
      OR: [
        { pasajeroId: id },
        {
          AND: [
            { pasajeroId: null },
            { pasajeroNombre: { equals: pasajero.nombre, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: { pasajeroId: true, pasajeroNombre: true, estado: true },
  });

  const nombreKey = pasajero.nombre.trim().toLowerCase();
  const rows = asistenciaRows.filter(
    (r) =>
      r.pasajeroId === id ||
      (!r.pasajeroId && r.pasajeroNombre.trim().toLowerCase() === nombreKey),
  ) as { pasajeroId: string | null; pasajeroNombre: string; estado: AsistenciaEstadoCount }[];

  const edadCalculada = edadDesdeCumpleanos(pasajero.fechaCumpleanos);
  return {
    ...pasajero,
    edadCalculada,
    edadMostrada: edadCalculada ?? pasajero.edad,
    asistencia: resumenAsistenciasFromRows(rows),
    areas: pasajero.areas.map((ap) => ({
      id: ap.area.id,
      nombre: ap.area.nombre,
      active: ap.area.active,
      destinos: ap.destinos.map((d) => d.destino),
    })),
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as {
      nombre?: string;
      direccion?: string;
      dni?: string | null;
      fechaCumpleanos?: string | null;
      edad?: number | string | null;
      active?: boolean;
      contactos?: ContactoInput[];
    };

    const existing = await prisma.pasajero.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Pasajero no encontrado.' }, { status: 404 });
    }

    const data: {
      nombre?: string;
      direccion?: string;
      dni?: string | null;
      fechaCumpleanos?: Date | null;
      edad?: number | null;
      active?: boolean;
    } = {};

    if (typeof body.nombre === 'string') {
      const nombre = body.nombre.trim();
      if (!nombre) {
        return NextResponse.json({ message: 'El nombre no puede quedar vacío.' }, { status: 400 });
      }
      data.nombre = nombre;
    }
    if (typeof body.direccion === 'string') {
      const direccion = body.direccion.trim();
      if (!direccion) {
        return NextResponse.json(
          { message: 'La dirección no puede quedar vacía.' },
          { status: 400 },
        );
      }
      data.direccion = direccion;
    }
    if (typeof body.active === 'boolean') data.active = body.active;

    if (body.dni !== undefined) {
      data.dni =
        body.dni === null || body.dni === '' ? null : String(body.dni).trim();
    }

    if (body.fechaCumpleanos !== undefined) {
      const parsed = parseOptionalDateInput(body.fechaCumpleanos);
      if (parsed === undefined) {
        return NextResponse.json(
          { message: 'Fecha de cumpleaños inválida.' },
          { status: 400 },
        );
      }
      data.fechaCumpleanos = parsed;
    }

    if (body.edad !== undefined) {
      if (body.edad === '' || body.edad === null) {
        data.edad = null;
      } else {
        const edad = Number(body.edad);
        if (Number.isNaN(edad) || edad < 0 || edad > 149 || !Number.isInteger(edad)) {
          return NextResponse.json(
            { message: 'La edad debe ser un número entero entre 0 y 149.' },
            { status: 400 },
          );
        }
        data.edad = edad;
      }
    }

    const contactos = parseContactos(body.contactos);
    if (body.contactos !== undefined && contactos === undefined) {
      return NextResponse.json(
        { message: 'Cada contacto necesita relación y teléfono.' },
        { status: 400 },
      );
    }

    if (Object.keys(data).length === 0 && contactos === undefined) {
      return NextResponse.json({ message: 'No hay cambios para guardar.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.pasajero.update({ where: { id }, data });
      }
      if (contactos !== undefined) {
        await tx.pasajeroContacto.deleteMany({ where: { pasajeroId: id } });
        if (contactos.length > 0) {
          await tx.pasajeroContacto.createMany({
            data: contactos.map((c) => ({
              pasajeroId: id,
              relacion: c.relacion,
              telefono: c.telefono,
            })),
          });
        }
      }
    });

    const pasajero = await loadSerialized(id);
    return NextResponse.json({ data: pasajero, message: 'Pasajero actualizado.' });
  } catch (error) {
    console.error('[API /admin/pasajeros PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el pasajero.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.pasajero.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Pasajero no encontrado.' }, { status: 404 });
    }

    await prisma.pasajero.delete({ where: { id } });
    return NextResponse.json({ message: 'Pasajero eliminado.' });
  } catch (error) {
    console.error('[API /admin/pasajeros DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar el pasajero.') },
      { status: 500 },
    );
  }
}
