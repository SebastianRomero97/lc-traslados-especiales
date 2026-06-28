import { SectionHeader } from '@/components/ui/SectionHeader';
import { AboutCarousel } from '@/components/sections/AboutCarousel';
import { features } from '@/data/landing.data';

export function About() {
  return (
    <section className="section section--alt" id="nosotros">
      <div className="container about-grid">
        <SectionHeader
          tag="Nosotros"
          title="Especialistas en traslados para niños"
        />

        <div className="about__visual">
          <AboutCarousel />
        </div>

        <div className="about__content">
          <p className="about__text">
            Somos una empresa dedicada y especializada en el traslado de niños, cada viaje está
            pensado para brindar contención, seguridad y tranquilidad a las familias.
          </p>
          <ul className="features-list">
            {features.map((feature) => (
              <li className="features-list__item" key={feature.title}>
                <span className="features-list__icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
