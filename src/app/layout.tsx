import type { Metadata } from 'next';
import { Nunito, Outfit } from 'next/font/google';
import { siteConfig } from '@/config/site.config';
import { RouteTransitionLoader } from '@/components/ui/RouteTransitionLoader';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: `${siteConfig.name} — Traslados para Niños con Discapacidad`,
  description: siteConfig.description,
  icons: {
    icon: [{ url: siteConfig.logoSrc, type: 'image/png' }],
    shortcut: siteConfig.logoSrc,
    apple: siteConfig.logoSrc,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${outfit.variable}`}>
      <body>
        <RouteTransitionLoader />
        {children}
      </body>
    </html>
  );
}
