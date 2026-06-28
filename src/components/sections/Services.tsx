'use client';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { useServices } from '@/hooks/useLandingData';

export function Services() {
  const { data: services, loading } = useServices();

  return (
    <section className="section" id="servicios">
      <div className="container">
        <SectionHeader
          tag="Servicios"
          title="Traslados pensados para cada niño"
          description="Llevamos a cada niño con el cuidado, la paciencia y la seguridad que él y su familia necesitan."
        />

        <div className="cards-grid" aria-busy={loading}>
          {services.map((service) => (
            <article className="card" key={service.id}>
              <div className="card__icon" aria-hidden="true">
                {service.icon}
              </div>
              <h3 className="card__title">{service.title}</h3>
              <p className="card__text">{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
