import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { isValidAssignableRoles, type Role } from '@/lib/roles';
import { describeCaughtError, missingFieldsMessage } from '@/lib/api-errors';
import { validatePasswordPlain } from '@/lib/password';

export async function GET() {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const users = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    select: {
      id: true,
      username: true,
      roles: true,
      active: true,
      isPrestador: true,
      puedeAprobar: true,
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
      roles?: unknown;
      role?: string;
      isPrestador?: boolean;
      puedeAprobar?: boolean;
    };

    const username = body.username?.trim();
    const password = body.password ?? '';

    // Compat: aceptar role único o roles[]
    const rolesInput: unknown =
      body.roles ?? (body.role ? [body.role] : undefined);

    const missing = missingFieldsMessage(
      { username, password, roles: rolesInput },
      { username: 'usuario', password: 'contraseña', roles: 'al menos un rol' },
    );
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    if (!username || username.length < 2) {
      return NextResponse.json(
        { message: 'El usuario debe tener al menos 2 caracteres.' },
        { status: 400 },
      );
    }

    const pwdError = validatePasswordPlain(password);
    if (pwdError) {
      return NextResponse.json({ message: pwdError }, { status: 400 });
    }

    if (!isValidAssignableRoles(rolesInput)) {
      return NextResponse.json(
        {
          message:
            'Seleccioná al menos un rol válido (Administración, Celadora y/o Chofer). El Admin no se asigna desde el panel.',
        },
        { status: 400 },
      );
    }

    const roles = rolesInput as Role[];
    const isPrestador = roles.includes('CHOFER') && body.isPrestador === true;
    const puedeAprobar = roles.includes('ADMINISTRACION') && body.puedeAprobar === true;

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
        roles,
        isPrestador,
        puedeAprobar,
        active: true,
      },
      select: {
        id: true,
        username: true,
        roles: true,
        active: true,
        isPrestador: true,
        puedeAprobar: true,
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
