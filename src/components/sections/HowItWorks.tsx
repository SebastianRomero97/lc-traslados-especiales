import { SectionHeader } from '@/components/ui/SectionHeader';
import { steps } from '@/data/landing.data';

export function HowItWorks() {
  return (
    <section className="section" id="como-funciona">
      <div className="container">
        <SectionHeader
          tag="Proceso"
          title="¿Cómo funciona?"
          description="Empezar es simple. En pocos pasos tu hijo ya tendrá su traslado asegurado."
          centered
        />

        <ol className="steps">
          {steps.map((step) => (
            <li className="step" key={step.number}>
              <span className="step__number">{step.number}</span>
              <h3 className="step__title">{step.title}</h3>
              <p className="step__text">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
