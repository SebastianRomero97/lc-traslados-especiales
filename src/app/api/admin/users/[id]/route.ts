import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-auth';
import { describeCaughtError } from '@/lib/api-errors';
import { validatePasswordPlain } from '@/lib/password';
import { isValidAssignableRoles, type Role } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ message: 'Usuario no indicado.' }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Usuario no encontrado.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      username?: string;
      active?: boolean;
      roles?: unknown;
      isPrestador?: boolean;
      password?: string;
      puedeAprobar?: boolean;
    };

    const data: {
      username?: string;
      active?: boolean;
      roles?: Role[];
      transporteId?: null;
      isPrestador?: boolean;
      puedeAprobar?: boolean;
      passwordHash?: string;
    } = {};

    if (typeof body.username === 'string') {
      const username = body.username.trim();
      if (username.length < 2) {
        return NextResponse.json(
          { message: 'El usuario debe tener al menos 2 caracteres.' },
          { status: 400 },
        );
      }
      if (username !== existing.username) {
        const taken = await prisma.user.findUnique({ where: { username } });
        if (taken) {
          return NextResponse.json(
            { message: 'Ese nombre de usuario ya existe.' },
            { status: 409 },
          );
        }
      }
      data.username = username;
    }

    if (typeof body.active === 'boolean') {
      if (id === auth.user.id && body.active === false) {
        return NextResponse.json(
          { message: 'No podés marcar tu propio usuario como No disponible.' },
          { status: 400 },
        );
      }
      if (
        existing.roles.includes('ADMIN') &&
        id !== auth.user.id &&
        body.active === false
      ) {
        return NextResponse.json(
          { message: 'No podés desactivar a otro Admin.' },
          { status: 400 },
        );
      }
      data.active = body.active;
    }

    if (body.roles !== undefined) {
      if (existing.roles.includes('ADMIN')) {
        return NextResponse.json(
          { message: 'No se pueden cambiar los roles de un Admin desde el panel.' },
          { status: 400 },
        );
      }
      if (!isValidAssignableRoles(body.roles)) {
        return NextResponse.json(
          {
            message:
              'Seleccioná al menos un rol válido (Administración, Celadora y/o Chofer). El Admin no se asigna desde el panel.',
          },
          { status: 400 },
        );
      }
      data.roles = body.roles;
      if (!body.roles.includes('CHOFER') && existing.transporteId) {
        data.transporteId = null;
      }
      if (!body.roles.includes('CHOFER')) {
        data.isPrestador = false;
      }
    }

    if (typeof body.isPrestador === 'boolean') {
      const rolesForCheck = (data.roles ?? existing.roles) as Role[];
      data.isPrestador = rolesForCheck.includes('CHOFER') ? body.isPrestador : false;
    }

    if (typeof body.puedeAprobar === 'boolean') {
      const rolesForCheck = (data.roles ?? existing.roles) as Role[];
      data.puedeAprobar = rolesForCheck.includes('ADMINISTRACION')
        ? body.puedeAprobar
        : false;
    } else if (data.roles && !data.roles.includes('ADMINISTRACION')) {
      data.puedeAprobar = false;
    }

    if (typeof body.password === 'string' && body.password.length > 0) {
      const targetIsAdmin = existing.roles.includes('ADMIN');
      if (targetIsAdmin && id !== auth.user.id) {
        return NextResponse.json(
          { message: 'No podés cambiar la contraseña de otro Admin.' },
          { status: 403 },
        );
      }
      const pwdError = validatePasswordPlain(body.password);
      if (pwdError) {
        return NextResponse.json({ message: pwdError }, { status: 400 });
      }
      data.passwordHash = await hash(body.password, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'No hay cambios para guardar.' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
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

    const message = data.passwordHash
      ? 'Usuario actualizado. Contraseña restablecida.'
      : 'Usuario actualizado.';

    return NextResponse.json({ data: user, message });
  } catch (error) {
    console.error('[API /admin/users PATCH]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos actualizar el usuario.') },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApi();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ message: 'Usuario no indicado.' }, { status: 400 });
  }

  if (id === auth.user.id) {
    return NextResponse.json(
      { message: 'No podés eliminar tu propio usuario.' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (existing.roles.includes('ADMIN')) {
      return NextResponse.json(
        { message: 'No se puede eliminar un usuario Admin desde el panel.' },
        { status: 400 },
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuario eliminado.' });
  } catch (error) {
    console.error('[API /admin/users DELETE]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No pudimos eliminar el usuario.') },
      { status: 500 },
    );
  }
}
