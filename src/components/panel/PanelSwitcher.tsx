'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type PanelLink = { path: string; label: string };

/**
 * Segmented control: el usuario elige el panel activo entre los accesibles.
 */
export function PanelSwitcher({ panels }: { panels: PanelLink[] }) {
  const pathname = usePathname();

  if (panels.length < 2) return null;

  return (
    <nav className="panel-segment" aria-label="Cambiar de panel">
      {panels.map((panel) => {
        const active =
          pathname === panel.path || pathname.startsWith(`${panel.path}/`);
        return (
          <Link
            key={panel.path}
            href={panel.path}
            className={`panel-segment__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {panel.label}
          </Link>
        );
      })}
    </nav>
  );
}
