import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { ROLE_LABEL, ROLE_PANEL_PATH, type Role, type SessionUser } from '@/lib/roles';
import { LogoutButton } from '@/components/panel/LogoutButton';

export async function requireRole(allowed: Role | Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(session.role)) {
    redirect(ROLE_PANEL_PATH[session.role]);
  }

  return session;
}

export function PanelShell({
  user,
  title,
  children,
}: {
  user: SessionUser;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-page">
      <header className="panel-header">
        <div className="panel-header__inner">
          <div>
            <p className="panel-header__tag">{ROLE_LABEL[user.role]}</p>
            <h1 className="panel-header__title">{title}</h1>
            <p className="panel-header__user">Sesión: {user.username}</p>
          </div>
          <div className="panel-header__actions">
            <Link href="/" className="btn btn--outline">
              Sitio web
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="panel-main">{children}</main>
    </div>
  );
}
