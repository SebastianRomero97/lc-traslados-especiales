import { siteConfig } from '@/config/site.config';
import { env } from '@/config/env';
import {
  services as mockServices,
  testimonials as mockTestimonials,
  institutionOptions,
} from '@/data/landing.data';
import { formatContactMessage } from '@/lib/contact.utils';
import { apiClient } from '@/services/api';
import { ApiClientError } from '@/services/api';
import type {
  ApiResponse,
  ContactFormData,
  ContactSubmission,
  Service,
  Testimonial,
} from '@/types';

const MOCK_DELAY_MS = 600;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Web3Forms debe llamarse desde el navegador (plan gratuito) */
async function submitViaWeb3Forms(
  data: ContactFormData,
): Promise<ApiResponse<ContactSubmission>> {
  const accessKey = env.web3formsAccessKey;
  if (!accessKey) {
    throw new ApiClientError({
      message: 'El envío de emails no está configurado.',
      statusCode: 503,
    });
  }

  const message = formatContactMessage({ ...data, institutionOptions });

  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      access_key: accessKey,
      subject: `Nueva consulta — ${data.nombre.trim()}`,
      from_name: data.nombre.trim(),
      email: data.email?.trim() || siteConfig.contact.email,
      phone: data.telefono.trim(),
      message,
    }),
  });

  const result = (await response.json()) as { success: boolean; message?: string };

  if (!response.ok || !result.success) {
    throw new ApiClientError({
      message: result.message ?? 'No pudimos enviar tu consulta. Intentá de nuevo.',
      statusCode: response.status,
    });
  }

  return {
    data: {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
    message: '¡Consulta enviada! Te contactaremos pronto.',
  };
}

/** Envía consulta — Web3Forms (cliente) o API interna (Gmail/Resend) */
export async function submitContactForm(
  data: ContactFormData,
): Promise<ApiResponse<ContactSubmission>> {
  if (env.web3formsAccessKey) {
    return submitViaWeb3Forms(data);
  }

  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiClientError({
      message: body.message ?? 'Error al enviar la consulta',
      statusCode: response.status,
    });
  }

  return body as ApiResponse<ContactSubmission>;
}

/** Obtiene servicios — futuro: desde base de datos */
export async function getServices(): Promise<Service[]> {
  if (env.useMockApi) {
    await delay(MOCK_DELAY_MS);
    return mockServices;
  }

  const response = await apiClient.get<ApiResponse<Service[]>>('/services');
  return response.data;
}

/** Obtiene testimonios — futuro: desde base de datos */
export async function getTestimonials(): Promise<Testimonial[]> {
  if (env.useMockApi) {
    await delay(MOCK_DELAY_MS);
    return mockTestimonials;
  }

  const response = await apiClient.get<ApiResponse<Testimonial[]>>('/testimonials');
  return response.data;
}
