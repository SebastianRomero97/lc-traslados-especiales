import { NextResponse } from 'next/server';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';

/** Alta de destinos (solo Admin). */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      areaId?: string;
      nombre?: string;
      domicilio?: string;
    };

    const areaId = body.areaId?.trim();
    const nombre = body.nombre?.trim();
    const domicilio = body.domicilio?.trim();

    const missing = missingFieldsMessage(
      { areaId, nombre, domicilio },
      { areaId: 'área', nombre: 'nombre del destino', domicilio: 'domicilio' },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    const area = await prisma.area.findUnique({ where: { id: areaId! } });
    if (!area) {
      return NextResponse.json({ message: 'Área no encontrada.' }, { status: 404 });
    }

    const destino = await prisma.destino.create({
      data: { areaId: areaId!, nombre: nombre!, domicilio: domicilio!, active: true },
    });

    return NextResponse.json({ data: destino, message: 'Destino creado.' }, { status: 201 });
  } catch (error) {
    console.error('[API /admin/destinos POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos crear el destino.') },
      { status: 500 },
    );
  }
}
