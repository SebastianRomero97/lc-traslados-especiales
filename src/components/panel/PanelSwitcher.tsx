'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type PanelLink = { path: string; label: string };

export function PanelSwitcher({ panels }: { panels: PanelLink[] }) {
  const pathname = usePathname();
  const current =
    panels.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`)) ?? panels[0];

  return (
    <nav className="admin-tabs-shell panel-switcher" aria-label="Cambiar de panel">
      <div className="admin-tabs" role="tablist">
        {panels.map((panel) => {
          const active = panel.path === current?.path;
          return (
            <Link
              key={panel.path}
              href={panel.path}
              role="tab"
              aria-selected={active}
              className={`admin-tabs__btn${active ? ' is-active' : ''}`}
            >
              {panel.label}
            </Link>
          );
        })}
      </div>
      <div className="admin-tabs__panel panel-switcher__hint" role="presentation">
        <p className="panel-card__desc" style={{ margin: 0 }}>
          Panel actual: <strong>{current?.label}</strong>
        </p>
      </div>
    </nav>
  );
}
