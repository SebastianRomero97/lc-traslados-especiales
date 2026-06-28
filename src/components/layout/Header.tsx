'use client';

import { navLinks } from '@/config/site.config';
import { useMobileNav } from '@/hooks/useMobileNav';
import { useScrollHeader } from '@/hooks/useScrollHeader';
import { Logo } from './Logo';

export function Header() {
  const isScrolled = useScrollHeader();
  const { isOpen, toggle, close } = useMobileNav();

  return (
    <>
      <header className={`header${isScrolled ? ' header--scrolled' : ''}`} id="inicio">
        <div className="container header__inner">
          <Logo />

          <button
            className="nav-toggle"
            onClick={toggle}
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`nav${isOpen ? ' nav--open' : ''}`} id="nav">
            <ul className="nav__list">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={`nav__link${link.isCta ? ' nav__link--cta' : ''}`}
                    onClick={close}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <div
        className={`nav-overlay${isOpen ? ' nav-overlay--visible' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
    </>
  );
}
