import type { NavLink, SiteConfig } from '@/types';

export const siteConfig: SiteConfig = {
  name: 'LC Traslados Especiales',
  brandHighlight: 'LC',
  brandName: 'Traslados Especiales',
  logoSrc: '/LOGOLC.png',
  tagline:
    'Traslados con contención y respeto para niños con discapacidad hacia sus centros de terapia y tratamiento.',
  description:
    'LC Traslados Especiales — traslados para niños con discapacidad hacia centros de terapia, rehabilitación y tratamiento. Conductores capacitados, rutas personalizadas y seguimiento en tiempo real.',
  contact: {
    phone: '11 3439-1857',
    phoneHref: 'tel:+5491134391857',
    email: 'seba97bass@gmail.com',
    whatsapp: '5491134391857',
    whatsappMessage:
      'Hola, me contacto desde la web de LC Traslados Especiales. Quisiera consultar por un traslado. Obra social: [indicar]. Institución: [indicar].',
    coverage: 'CABA y GBA — Consultá por tu barrio',
  },
  copyright: 'LC Traslados Especiales',
};

export const navLinks: NavLink[] = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#testimonios', label: 'Testimonios' },
  { href: '/login', label: 'Iniciar sesión', isCta: true },
];

export const footerNavLinks: NavLink[] = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '/login', label: 'Iniciar sesión' },
];

export const legalLinks: NavLink[] = [
  { href: '#', label: 'Términos y condiciones' },
  { href: '#', label: 'Política de privacidad' },
];
