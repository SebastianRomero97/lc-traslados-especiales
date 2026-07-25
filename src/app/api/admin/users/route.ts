import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import type { Role } from '@/lib/roles';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';

const ASSIGNABLE_ROLES: Role[] = ['COORDINADORA', 'CELADORA', 'CHOFER'];

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: users });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      role?: string;
    };

    const username = body.username?.trim();
    const password = body.password ?? '';
    const role = body.role as Role | undefined;

    const missing = missingFieldsMessage(
      { username, password, role },
      { username: 'usuario', password: 'contraseña', role: 'entidad' },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    if (username.length < 2) {
      return NextResponse.json(
        { message: 'El usuario debe tener al menos 2 caracteres.' },
        { status: 400 },
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { message: 'La contraseña debe tener al menos 4 caracteres.' },
        { status: 400 },
      );
    }

    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { message: 'La entidad seleccionada no es válida.' },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { message: 'Ese nombre de usuario ya existe.' },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
        active: true,
      },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { data: user, message: 'Usuario creado correctamente.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[API /admin/users POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos crear el usuario.') },
      { status: 500 },
    );
  }
}
