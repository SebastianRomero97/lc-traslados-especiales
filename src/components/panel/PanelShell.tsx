import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import {
  accessiblePanelsFor,
  defaultPanelPath,
  formatRoles,
  hasAnyRole,
  type Role,
  type SessionUser,
} from '@/lib/roles';
import { LogoutButton } from '@/components/panel/LogoutButton';
import { PanelSwitcher } from '@/components/panel/PanelSwitcher';

export async function requireRole(allowed: Role | Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!hasAnyRole(session, roles)) {
    redirect(defaultPanelPath(session));
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
  const panels = accessiblePanelsFor(user);
  const showSwitcher = panels.length > 1;

  return (
    <div className="panel-page">
      <header className="panel-header">
        <div className="panel-header__inner">
          <div>
            <p className="panel-header__tag">{formatRoles(user.roles)}</p>
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
      <main className="panel-main">
        {showSwitcher && <PanelSwitcher panels={panels} />}
        {children}
      </main>
    </div>
  );
}
