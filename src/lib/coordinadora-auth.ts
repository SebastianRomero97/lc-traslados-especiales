import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasAnyRole, type SessionUser } from '@/lib/roles';

export async function requireCoordinadoraApi(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const session = await getSession();

  if (!session) {
    return {
      error: NextResponse.json({ message: 'No autenticado.' }, { status: 401 }),
    };
  }

  if (!hasAnyRole(session, ['COORDINADORA', 'ADMIN'])) {
    return {
      error: NextResponse.json({ message: 'No autorizado.' }, { status: 403 }),
    };
  }

  return { user: session };
}
