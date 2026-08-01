import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '@/lib/constants';
import {
  defaultPanelPath,
  hasRole,
  type Role,
} from '@/lib/roles';

const PANEL_ROLE: Record<string, Role> = {
  '/panel/admin': 'ADMIN',
  '/panel/administracion': 'ADMINISTRACION',
  '/panel/celadora': 'CELADORA',
  '/panel/chofer': 'CHOFER',
};

type SessionPayload = { roles?: unknown; role?: unknown };

function rolesFromPayload(payload: SessionPayload): Role[] {
  const valid: Role[] = ['ADMIN', 'ADMINISTRACION', 'CELADORA', 'CHOFER'];
  if (Array.isArray(payload.roles)) {
    return payload.roles.filter((r): r is Role => valid.includes(r as Role));
  }
  if (typeof payload.role === 'string' && valid.includes(payload.role as Role)) {
    return [payload.role as Role];
  }
  return [];
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;

  // Redirect bookmarks de la ruta antigua
  if (pathname.startsWith('/panel/coordinadora')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/panel\/coordinadora/, '/panel/administracion');
    return NextResponse.redirect(url, 308);
  }

  // Sin AUTH_SECRET no se puede validar sesión: dejar pasar /login (evitar bucle)
  // y mandar paneles a login una sola vez.
  if (!secret) {
    if (pathname.startsWith('/login')) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let roles: Role[] = [];
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      roles = rolesFromPayload(payload as SessionPayload);
    } catch {
      roles = [];
    }
  }

  const sessionUser = { roles };

  if (pathname.startsWith('/login')) {
    if (roles.length > 0) {
      return NextResponse.redirect(new URL(defaultPanelPath(sessionUser), request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/panel')) {
    if (roles.length === 0) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Ordenar paths más largos primero para que /panel/administracion
    // no matchee el prefijo /panel/admin.
    const requiredRole = Object.entries(PANEL_ROLE)
      .sort(([a], [b]) => b.length - a.length)
      .find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];

    // Admin puede entrar al panel de Administración para soporte
    const isAdminOnAdministracion =
      hasRole(sessionUser, 'ADMIN') && pathname.startsWith('/panel/administracion');

    if (requiredRole && !hasRole(sessionUser, requiredRole) && !isAdminOnAdministracion) {
      return NextResponse.redirect(new URL(defaultPanelPath(sessionUser), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/panel/:path*'],
};
