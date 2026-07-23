import Link from 'next/link';
import { footerNavLinks, legalLinks, siteConfig } from '@/config/site.config';
import { Logo } from './Logo';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo variant="footer" />
          <p className="footer__tagline">{siteConfig.tagline}</p>
        </div>

        <div className="footer__links">
          <h4>Navegación</h4>
          <ul>
            {footerNavLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('/') ? (
                  <Link href={link.href}>{link.label}</Link>
                ) : (
                  <a href={link.href}>{link.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__links">
          <h4>Legal</h4>
          <ul>
            {legalLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container">
          <p>
            &copy; {year} {siteConfig.copyright}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
