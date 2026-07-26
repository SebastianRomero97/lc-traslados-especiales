import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { defaultPanelPath, type Role } from '@/lib/roles';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim();
    const password = body.password ?? '';

    if (!username || !password) {
      return NextResponse.json(
        { message: 'Ingresá usuario y contraseña.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // Usuario inexistente (eliminado) o desactivado por Admin
    if (!user || !user.active) {
      return NextResponse.json(
        { message: 'Credencial no autorizada' },
        { status: 401 },
      );
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { message: 'Credencial no autorizada' },
        { status: 401 },
      );
    }

    const roles = user.roles as Role[];
    const sessionUser = {
      id: user.id,
      username: user.username,
      roles,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    return NextResponse.json({
      message: 'Sesión iniciada.',
      redirectTo: defaultPanelPath(sessionUser),
      user: sessionUser,
    });
  } catch (error) {
    console.error('[API /auth/login]', error);
    return NextResponse.json(
      { message: 'No pudimos iniciar sesión. Intentá de nuevo.' },
      { status: 500 },
    );
  }
}
