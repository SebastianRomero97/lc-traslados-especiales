import { Button } from '@/components/ui/Button';
import { siteConfig } from '@/config/site.config';
import { heroStats } from '@/data/landing.data';
import { getWhatsAppUrl } from '@/lib/contact.utils';

export function Hero() {
  const whatsappUrl = getWhatsAppUrl(
    siteConfig.contact.whatsapp,
    siteConfig.contact.whatsappMessage,
  );

  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__content">
          <h1 className="hero__title">
            Acompañamos a tu hijo <span className="text-gradient">con cuidado</span> a su destino
          </h1>
          <p className="hero__subtitle">
            Traslados para niños con necesidades especiales hacia centros de terapia, rehabilitación y
            tratamiento. Conductores capacitados, rutas personalizadas y la tranquilidad que tu
            familia necesita.
          </p>
          <div className="hero__actions">
            <Button
              as="a"
              href={whatsappUrl}
              variant="primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Solicitar información
            </Button>
            <Button as="a" href="#servicios" variant="outline">
              Ver servicios
            </Button>
          </div>
          <div className="hero__stats">
            {heroStats.map((stat) => (
              <div className="stat" key={stat.label}>
                <strong className="stat__number">{stat.value}</strong>
                <span className="stat__label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hero__wave" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path
            d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </section>
  );
}
