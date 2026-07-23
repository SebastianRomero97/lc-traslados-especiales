import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { institutionOptions } from '@/data/landing.data';
import { formatContactMessage } from '@/lib/contact.utils';
import type { ApiResponse, ContactFormData, ContactSubmission } from '@/types';

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'seba97bass@gmail.com';
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'LC Traslados Especiales <onboarding@resend.dev>';

function buildEmailHtml(data: ContactFormData) {
  const body = formatContactMessage({ ...data, institutionOptions });
  return `<h2>Nueva consulta desde la web</h2><pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`;
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
  try {
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

    const subject = `Nueva consulta — ${data.nombre.trim()}`;
    const html = buildEmailHtml(data);

    const sentWithGmail = await sendViaGmail(data, subject, html);
    const sentWithResend = !sentWithGmail && (await sendViaResend(data, subject, html));

    if (!sentWithGmail && !sentWithResend) {
      console.error(
        '[API /contact] Email no configurado. Agregá RESEND_API_KEY, GMAIL_USER/GMAIL_APP_PASSWORD o NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY en Vercel.',
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
