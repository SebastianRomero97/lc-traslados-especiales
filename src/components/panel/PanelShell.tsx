import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import {
  accessiblePanelsFor,
  defaultPanelPath,
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
  children,
}: {
  user: SessionUser;
  /** @deprecated El título fijo se reemplazó por el selector de paneles. */
  title?: string;
  children?: ReactNode;
}) {
  const panels = accessiblePanelsFor(user);
  const showSwitcher = panels.length > 1;

  return (
    <div className="panel-page">
      <header className="panel-header">
        <div className="panel-header__inner">
          <div className="panel-header__brand">
            {showSwitcher ? (
              <PanelSwitcher panels={panels} />
            ) : (
              <p className="panel-header__panel-name">{panels[0]?.label ?? 'Panel'}</p>
            )}
            <p className="panel-header__user">Sesión: {user.username}</p>
          </div>
          <div className="panel-header__actions">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="panel-main">{children}</main>
    </div>
  );
}
