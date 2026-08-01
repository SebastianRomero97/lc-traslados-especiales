import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { institutionOptions } from '@/data/landing.data';
import { formatContactMessage } from '@/lib/contact.utils';
import { clientIpFromRequest, consumeRateLimit } from '@/lib/rate-limit';
import type { ApiResponse, ContactFormData, ContactSubmission } from '@/types';

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'seba97bass@gmail.com';
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'LC Traslados Especiales <onboarding@resend.dev>';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(data: ContactFormData) {
  const body = formatContactMessage({ ...data, institutionOptions });
  return `<h2>Nueva consulta desde la web</h2><pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`;
}

async function sendViaGmail(data: ContactFormData, subject: string, html: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return false;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `LC Traslados Especiales <${user}>`,
    to: CONTACT_TO_EMAIL,
    replyTo: data.email?.trim() || undefined,
    subject,
    html,
  });

  return true;
}

async function sendViaResend(data: ContactFormData, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: CONTACT_TO_EMAIL,
    replyTo: data.email?.trim() || undefined,
    subject,
    html,
  });

  if (error) throw error;
  return true;
}

export async function POST(request: Request) {
  // Contacto público deshabilitado por defecto (landing sin sección Contacto).
  if (process.env.CONTACT_ENABLED !== 'true') {
    return NextResponse.json(
      {
        message:
          'El formulario de contacto no está disponible por ahora. Escribinos por WhatsApp.',
      },
      { status: 503 },
    );
  }

  try {
    const ip = clientIpFromRequest(request);
    const limited = consumeRateLimit(`contact:${ip}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { message: `Demasiados envíos. Probá en ${limited.retryAfterSec} segundos.` },
        {
          status: 429,
          headers: { 'Retry-After': String(limited.retryAfterSec) },
        },
      );
    }

    const data = (await request.json()) as ContactFormData;

    if (!data.nombre?.trim() || !data.telefono?.trim() || !data.obraSocial?.trim()) {
      return NextResponse.json(
        { message: 'Completá nombre, teléfono y obra social.' },
        { status: 400 },
      );
    }

    if (!data.institucion) {
      return NextResponse.json(
        { message: 'Seleccioná una institución de destino.' },
        { status: 400 },
      );
    }

    if (data.institucion === 'otra' && !data.institucionOtra?.trim()) {
      return NextResponse.json(
        { message: 'Escribí el nombre de la institución.' },
        { status: 400 },
      );
    }

    const subject = `Nueva consulta — ${data.nombre.trim().slice(0, 80)}`;
    const html = buildEmailHtml(data);

    const sentWithGmail = await sendViaGmail(data, subject, html);
    const sentWithResend = !sentWithGmail && (await sendViaResend(data, subject, html));

    if (!sentWithGmail && !sentWithResend) {
      console.error(
        '[API /contact] Email no configurado. Agregá RESEND_API_KEY o GMAIL_USER/GMAIL_APP_PASSWORD.',
      );
      return NextResponse.json(
        {
          message:
            'No pudimos enviar tu consulta en este momento. Escribinos por WhatsApp o al teléfono y te respondemos a la brevedad.',
        },
        { status: 503 },
      );
    }

    const response: ApiResponse<ContactSubmission> = {
      data: {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      message: '¡Consulta enviada! Te contactaremos pronto.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /contact] Error inesperado:', error);
    return NextResponse.json(
      { message: 'No pudimos enviar tu consulta. Intentá de nuevo más tarde.' },
      { status: 500 },
    );
  }
}
