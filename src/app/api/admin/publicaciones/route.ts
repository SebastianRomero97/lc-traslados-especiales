import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import type { Role } from '@/lib/roles';

const DESTINATARIOS: Role[] = ['COORDINADORA', 'CELADORA', 'CHOFER'];

function parseRoles(input: unknown): Role[] | null {
  if (!Array.isArray(input)) return null;
  const roles = [...new Set(input.map(String))].filter((r): r is Role =>
    DESTINATARIOS.includes(r as Role),
  );
  return roles.length > 0 ? roles : null;
}

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const items = await prisma.publicacion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      titulo: true,
      cuerpo: true,
      roles: true,
      startsAt: true,
      endsAt: true,
      active: true,
      createdAt: true,
      createdBy: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({ data: items });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      titulo?: string;
      cuerpo?: string;
      roles?: unknown;
      startsAt?: string;
      endsAt?: string;
      active?: boolean;
    };

    const titulo = body.titulo?.trim() ?? '';
    const cuerpo = body.cuerpo?.trim() ?? '';
    const roles = parseRoles(body.roles);

    if (titulo.length < 3) {
      return NextResponse.json(
        { message: 'El título debe tener al menos 3 caracteres.' },
        { status: 400 },
      );
    }
    if (cuerpo.length < 5) {
      return NextResponse.json(
        { message: 'El mensaje debe tener al menos 5 caracteres.' },
        { status: 400 },
      );
    }
    if (!roles) {
      return NextResponse.json(
        { message: 'Seleccioná al menos un destinatario (coordinadoras, celadoras o choferes).' },
        { status: 400 },
      );
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;

    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json(
        { message: 'Indicá hasta cuándo es válida la publicación.' },
        { status: 400 },
      );
    }
    if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) {
      return NextResponse.json(
        { message: 'La fecha de fin debe ser posterior al inicio.' },
        { status: 400 },
      );
    }

    const item = await prisma.publicacion.create({
      data: {
        titulo,
        cuerpo,
        roles,
        startsAt,
        endsAt,
        active: body.active !== false,
        createdById: auth.user.id,
      },
      select: {
        id: true,
        titulo: true,
        cuerpo: true,
        roles: true,
        startsAt: true,
        endsAt: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { data: item, message: 'Publicación creada.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /admin/publicaciones POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos crear la publicación.') },
      { status: 500 },
    );
  }
}
