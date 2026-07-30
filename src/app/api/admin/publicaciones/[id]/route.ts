import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import type { Role } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const DESTINATARIOS: Role[] = ['COORDINADORA', 'CELADORA', 'CHOFER'];

function parseRoles(input: unknown): Role[] | null {
  if (!Array.isArray(input)) return null;
  const roles = [...new Set(input.map(String))].filter((r): r is Role =>
    DESTINATARIOS.includes(r as Role),
  );
  return roles.length > 0 ? roles : null;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    const existing = await prisma.publicacion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Publicación no encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      titulo?: string;
      cuerpo?: string;
      roles?: unknown;
      startsAt?: string;
      endsAt?: string;
      active?: boolean;
    };

    const data: {
      titulo?: string;
      cuerpo?: string;
      roles?: Role[];
      startsAt?: Date;
      endsAt?: Date;
      active?: boolean;
    } = {};

    if (typeof body.titulo === 'string') {
      const titulo = body.titulo.trim();
      if (titulo.length < 3) {
        return NextResponse.json(
          { message: 'El título debe tener al menos 3 caracteres.' },
          { status: 400 },
        );
      }
      data.titulo = titulo;
    }
    if (typeof body.cuerpo === 'string') {
      const cuerpo = body.cuerpo.trim();
      if (cuerpo.length < 5) {
        return NextResponse.json(
          { message: 'El mensaje debe tener al menos 5 caracteres.' },
          { status: 400 },
        );
      }
      data.cuerpo = cuerpo;
    }
    if (body.roles !== undefined) {
      const roles = parseRoles(body.roles);
      if (!roles) {
        return NextResponse.json(
          {
            message:
              'Seleccioná al menos un destinatario (Administración, celadoras o choferes).',
          },
          { status: 400 },
        );
      }
      data.roles = roles;
    }
    if (typeof body.startsAt === 'string') {
      data.startsAt = new Date(body.startsAt);
    }
    if (typeof body.endsAt === 'string') {
      data.endsAt = new Date(body.endsAt);
    }
    if (typeof body.active === 'boolean') data.active = body.active;

    const startsAt = data.startsAt ?? existing.startsAt;
    const endsAt = data.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) {
      return NextResponse.json(
        { message: 'La fecha de fin debe ser posterior al inicio.' },
        { status: 400 },
      );
    }

    const item = await prisma.publicacion.update({
      where: { id },
      data,
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

    return NextResponse.json({ data: item, message: 'Publicación actualizada.' });
  } catch (error) {
    console.error('[API /admin/publicaciones PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar la publicación.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    await prisma.publicacion.delete({ where: { id } });
    return NextResponse.json({ message: 'Publicación eliminada.' });
  } catch (error) {
    console.error('[API /admin/publicaciones DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar la publicación.') },
      { status: 500 },
    );
  }
}
