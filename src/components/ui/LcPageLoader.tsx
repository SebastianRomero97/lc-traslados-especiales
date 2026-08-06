import { siteConfig } from '@/config/site.config';

type Props = {
  /** Cubre toda la pantalla (navegación / carga de ruta). */
  overlay?: boolean;
  label?: string;
};

/** Loader de marca: logo en tarjeta con giro + pulso tipo rueda. */
export function LcPageLoader({
  overlay = false,
  label = 'Cargando…',
}: Props) {
  const content = (
    <div className="lc-loader__card" role="status" aria-live="polite" aria-busy="true">
      <div className="lc-loader__wheel">
        {/* eslint-disable-next-line @next/next/no-img-element -- loading.tsx / overlay sin Image */}
        <img
          src={siteConfig.logoSrc}
          alt=""
          width={88}
          height={88}
          className="lc-loader__logo"
          decoding="async"
        />
      </div>
      <p className="lc-loader__label">{label}</p>
    </div>
  );

  if (!overlay) {
    return <div className="lc-loader lc-loader--inline">{content}</div>;
  }

  return (
    <div className="lc-loader lc-loader--overlay">
      <div className="lc-loader__backdrop" aria-hidden="true" />
      {content}
    </div>
  );
}
