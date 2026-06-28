'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { siteConfig } from '@/config/site.config';
import { institutionOptions } from '@/data/landing.data';
import { submitContactForm } from '@/services/contact.service';
import { ApiClientError } from '@/services/api';
import { getWhatsAppUrl } from '@/lib/contact.utils';
import type { ContactFormData } from '@/types';

const initialForm: ContactFormData = {
  nombre: '',
  telefono: '',
  email: '',
  obraSocial: '',
  institucion: '',
  institucionOtra: '',
  mensaje: '',
};

export function Contact() {
  const [form, setForm] = useState<ContactFormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const { contact } = siteConfig;
  const whatsappUrl = getWhatsAppUrl(contact.whatsapp, contact.whatsappMessage);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'institucion' && value !== 'otra' ? { institucionOtra: '' } : {}),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!form.institucion) {
      setFeedback({ type: 'error', message: 'Seleccioná una institución de destino.' });
      return;
    }

    if (form.institucion === 'otra' && !form.institucionOtra?.trim()) {
      setFeedback({ type: 'error', message: 'Escribí el nombre de la institución.' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await submitContactForm(form);
      setFeedback({
        type: 'success',
        message: response.message ?? '¡Gracias! Te contactaremos pronto.',
      });
      setForm(initialForm);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'No pudimos enviar tu consulta. Intentá de nuevo.';
      setFeedback({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section section--contact" id="contacto">
      <div className="container contact-grid">
        <div className="contact__info">
          <SectionHeader tag="Contacto" title="¿Listo para empezar?" />
          <p className="contact__text">
            Trabajamos con obras sociales. Completá el formulario con tu cobertura e institución de
            destino y te respondemos a la brevedad.
          </p>

          <ul className="contact__details">
            <li>
              <span aria-hidden="true">📞</span>
              <div>
                <strong>Teléfono</strong>
                <a href={contact.phoneHref}>{contact.phone}</a>
              </div>
            </li>
            <li>
              <span aria-hidden="true">✉️</span>
              <div>
                <strong>Email</strong>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </div>
            </li>
            <li>
              <span aria-hidden="true">📍</span>
              <div>
                <strong>Zona de cobertura</strong>
                <span>{contact.coverage}</span>
              </div>
            </li>
          </ul>

          <Button as="a" href={whatsappUrl} variant="whatsapp" target="_blank" rel="noopener noreferrer">
            Escribinos por WhatsApp
          </Button>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre">Nombre completo</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Tu nombre"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="telefono">Teléfono</label>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="+54 9 ..."
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="obraSocial">Obra social</label>
            <input
              type="text"
              id="obraSocial"
              name="obraSocial"
              value={form.obraSocial}
              onChange={handleChange}
              placeholder="Ej: OSDE, PAMI, IOMA, Swiss Medical..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="institucion">Institución de destino</label>
            <select
              id="institucion"
              name="institucion"
              value={form.institucion}
              onChange={handleChange}
              required
            >
              <option value="">Seleccioná una institución</option>
              {institutionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {form.institucion === 'otra' && (
            <div className="form-group">
              <label htmlFor="institucionOtra">Nombre de la institución</label>
              <input
                type="text"
                id="institucionOtra"
                name="institucionOtra"
                value={form.institucionOtra}
                onChange={handleChange}
                placeholder="Escribí el nombre de la institución"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="mensaje">Información adicional</label>
            <textarea
              id="mensaje"
              name="mensaje"
              rows={4}
              value={form.mensaje}
              onChange={handleChange}
              placeholder="Horarios, dirección, necesidades del niño/a u otro dato que consideres importante..."
            />
            <p className="form-hint">Agregá cualquier información que nos ayude a coordinar el traslado.</p>
          </div>

          {feedback && (
            <p className={`form-feedback form-feedback--${feedback.type}`} role="status">
              {feedback.message}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar consulta'}
          </Button>
        </form>
      </div>
    </section>
  );
}
