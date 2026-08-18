import { NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { describeCaughtError } from '@/lib/api-errors';
import { defaultPanelPath, type Role } from '@/lib/roles';
import {
  getWebAuthnConfig,
  setWebAuthnChallengeCookie,
  consumeWebAuthnChallengeCookie,
  transportsFromDb,
} from '@/lib/webauthn';
import { clientIpFromRequest, consumeRateLimit } from '@/lib/rate-limit';

/** Opciones de autenticación biométrica. Body opcional: { username? }. */
export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = consumeRateLimit(`webauthn-login:${ip}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        {
          message: `Demasiados intentos. Probá en ${limited.retryAfterSec} segundos.`,
        },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      response?: AuthenticationResponseJSON;
    };

    // Si viene `response`, es la verificación del login.
    if (body.response) {
      return verifyLogin(body.response);
    }

    const { rpID } = getWebAuthnConfig();
    const username = body.username?.trim();

    let allowCredentials:
      | { id: string; transports?: ReturnType<typeof transportsFromDb> }[]
      | undefined;

    if (username) {
      const user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          active: true,
          webauthnCredentials: {
            select: { credentialId: true, transports: true },
          },
        },
      });
      if (!user || !user.active || user.webauthnCredentials.length === 0) {
        return NextResponse.json(
          {
            message:
              'Este usuario no tiene huella/Face ID registrada, o el usuario no existe.',
          },
          { status: 400 },
        );
      }
      allowCredentials = user.webauthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: transportsFromDb(c.transports),
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials,
    });

    await setWebAuthnChallengeCookie({
      challenge: options.challenge,
      type: 'login',
    });

    return NextResponse.json({ data: options });
  } catch (error) {
    console.error('[API webauthn/login POST]', error);
    return NextResponse.json(
      {
        message: describeCaughtError(
          error,
          'No se pudo iniciar el login biométrico. Revisá la configuración WebAuthn.',
        ),
      },
      { status: 500 },
    );
  }
}

async function verifyLogin(response: AuthenticationResponseJSON) {
  const expected = await consumeWebAuthnChallengeCookie();
  if (!expected || expected.type !== 'login') {
    return NextResponse.json(
      { message: 'El desafío expiró. Volvé a intentar con la huella.' },
      { status: 400 },
    );
  }

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          roles: true,
          active: true,
          isPrestador: true,
          puedeAprobar: true,
        },
      },
    },
  });

  if (!credential || !credential.user.active) {
    return NextResponse.json(
      { message: 'Credencial biométrica no reconocida.' },
      { status: 401 },
    );
  }

  const { rpID, origin } = getWebAuthnConfig();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: expected.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credential.credentialId,
      publicKey: isoBase64URL.toBuffer(credential.publicKey),
      counter: Number(credential.counter),
      transports: transportsFromDb(credential.transports),
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    return NextResponse.json(
      { message: 'No se pudo verificar la huella / Face ID.' },
      { status: 401 },
    );
  }

  await prisma.webAuthnCredential.update({
    where: { id: credential.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  const sessionUser = {
    id: credential.user.id,
    username: credential.user.username,
    roles: credential.user.roles as Role[],
    isPrestador: Boolean(credential.user.isPrestador),
    puedeAprobar: Boolean(credential.user.puedeAprobar),
  };

  const token = await createSessionToken(sessionUser);
  await setSessionCookie(token);

  return NextResponse.json({
    message: 'Sesión iniciada con biometría.',
    redirectTo: defaultPanelPath(sessionUser),
    user: sessionUser,
  });
}
