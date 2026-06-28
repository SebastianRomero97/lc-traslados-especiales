import Image from 'next/image';
import { siteConfig } from '@/config/site.config';

interface LogoProps {
  variant?: 'default' | 'footer';
}

export function Logo({ variant = 'default' }: LogoProps) {
  const { brandHighlight, brandName, logoSrc } = siteConfig;

  return (
    <a href="#inicio" className={`logo${variant === 'footer' ? ' logo--footer' : ''}`}>
      <Image
        src={logoSrc}
        alt=""
        width={48}
        height={48}
        className="logo__image"
        priority
      />
      <span className="logo__text">
        <span className="logo__accent">{brandHighlight}</span> {brandName}
      </span>
    </a>
  );
}
