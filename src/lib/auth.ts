import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/constants';
import type { SessionUser } from '@/lib/roles';
import type { Role } from '@/lib/roles';

const SESSION_DAYS = 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('Falta AUTH_SECRET en las variables de entorno.');
  }
  return new TextEncoder().encode(secret);
}

function isRole(value: unknown): value is Role {
  return (
    value === 'ADMIN' ||
    value === 'COORDINADORA' ||
    value === 'CELADORA' ||
    value === 'CHOFER'
  );
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    roles: user.roles,
    isPrestador: Boolean(user.isPrestador),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.id !== 'string' || typeof payload.username !== 'string') {
      return null;
    }

    let roles: Role[] = [];
    if (Array.isArray(payload.roles)) {
      roles = payload.roles.filter(isRole);
    } else if (typeof payload.role === 'string' && isRole(payload.role)) {
      // Compatibilidad con sesiones antiguas (un solo role)
      roles = [payload.role];
    }

    if (roles.length === 0) return null;

    return {
      id: payload.id,
      username: payload.username,
      roles,
      isPrestador: Boolean(payload.isPrestador),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
