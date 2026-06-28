'use client';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { useTestimonials } from '@/hooks/useLandingData';

export function Testimonials() {
  const { data: testimonials, loading } = useTestimonials();

  return (
    <section className="section section--alt" id="testimonios">
      <div className="container">
        <SectionHeader tag="Testimonios" title="Lo que dicen las familias" centered />

        <div className="testimonials-grid" aria-busy={loading}>
          {testimonials.map((testimonial) => (
            <blockquote className="testimonial" key={testimonial.id}>
              <p className="testimonial__text">&ldquo;{testimonial.text}&rdquo;</p>
              <footer className="testimonial__author">
                <strong>{testimonial.author}</strong>
                <span>{testimonial.role}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
