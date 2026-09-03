import { NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import {
  getWebAuthnConfig,
  setWebAuthnChallengeCookie,
  consumeWebAuthnChallengeCookie,
  transportsFromDb,
} from '@/lib/webauthn';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

/** Opciones para registrar huella/Face ID (usuario ya logueado). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }

  try {
    const { rpID, rpName, origin } = getWebAuthnConfig(request);
    const existing = await prisma.webAuthnCredential.findMany({
      where: { userId: session.id },
      select: { credentialId: true, transports: true },
    });

    const userIdBytes = new Uint8Array(new TextEncoder().encode(session.id));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: session.username,
      userDisplayName: session.username,
      userID: userIdBytes,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: transportsFromDb(c.transports),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    await setWebAuthnChallengeCookie({
      challenge: options.challenge,
      type: 'register',
      userId: session.id,
      rpID,
      origin,
    });

    return NextResponse.json({ data: options });
  } catch (error) {
    console.error('[API webauthn/register GET]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(
          error,
          'No se pudo preparar el registro de huella. Revisá WEBAUTHN_RP_ID / ORIGIN en producción.',
        ),
      },
      { status: 500 },
    );
  }
}

/** Verifica y guarda la credencial WebAuthn. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      response?: RegistrationResponseJSON;
      label?: string;
    };
    if (!body.response) {
      return NextResponse.json({ message: 'Falta la respuesta del autenticador.' }, { status: 400 });
    }

    const expected = await consumeWebAuthnChallengeCookie();
    if (!expected || expected.type !== 'register' || expected.userId !== session.id) {
      return NextResponse.json(
        { message: 'El desafío expiró. Volvé a intentar registrar la huella.' },
        { status: 400 },
      );
    }

    const cfg = getWebAuthnConfig(request);
    const rpID = expected.rpID || cfg.rpID;
    const origin = expected.origin || cfg.origin;
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: expected.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { message: 'No se pudo verificar el registro biométrico.' },
        { status: 400 },
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const credentialId = credential.id;
    const publicKey = isoBase64URL.fromBuffer(credential.publicKey);
    const transports = body.response.response.transports ?? [];

    await prisma.webAuthnCredential.create({
      data: {
        userId: session.id,
        credentialId,
        publicKey,
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: [...transports],
        label: body.label?.trim() || 'Este dispositivo',
      },
    });

    return NextResponse.json({
      message: 'Huella / Face ID activada en este dispositivo.',
    });
  } catch (error) {
    console.error('[API webauthn/register POST]', error);
    return NextResponse.json(
      { message: describeCaughtError(error, 'No se pudo guardar la huella.') },
      { status: 500 },
    );
  }
}
