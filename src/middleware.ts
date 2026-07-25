import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '@/lib/constants';
import { ROLE_PANEL_PATH, type Role } from '@/lib/roles';

const PANEL_ROLE: Record<string, Role> = {
  '/panel/admin': 'ADMIN',
  '/panel/coordinadora': 'COORDINADORA',
  '/panel/celadora': 'CELADORA',
  '/panel/chofer': 'CHOFER',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let session: { role?: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      session = payload as { role?: string };
    } catch {
      session = null;
    }
  }

  if (pathname.startsWith('/login')) {
    if (session?.role && session.role in ROLE_PANEL_PATH) {
      return NextResponse.redirect(
        new URL(ROLE_PANEL_PATH[session.role as Role], request.url),
      );
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/panel')) {
    if (!session?.role) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const requiredRole = Object.entries(PANEL_ROLE).find(([path]) =>
      pathname.startsWith(path),
    )?.[1];

    // Admin puede entrar al panel de coordinadora para soporte
    const isAdminOnCoord =
      session.role === 'ADMIN' && pathname.startsWith('/panel/coordinadora');

    if (requiredRole && session.role !== requiredRole && !isAdminOnCoord) {
      return NextResponse.redirect(
        new URL(ROLE_PANEL_PATH[session.role as Role], request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/panel/:path*'],
};
