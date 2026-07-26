import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasAnyRole, type Role, type SessionUser } from '@/lib/roles';

export async function requireOperativoApi(
  allowed: Role[],
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const session = await getSession();

  if (!session) {
    return {
      error: NextResponse.json({ message: 'No autenticado.' }, { status: 401 }),
    };
  }

  if (!hasAnyRole(session, allowed)) {
    return {
      error: NextResponse.json({ message: 'No autorizado.' }, { status: 403 }),
    };
  }

  return { user: session };
}
