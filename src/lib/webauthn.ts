import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';

const CHALLENGE_COOKIE = 'lc_webauthn_challenge';

/**
 * RP ID / origin para WebAuthn.
 * - Preferí Origin del browser (coincide con la barra de direcciones).
 * - Env WEBAUTHN_* / NEXT_PUBLIC_APP_URL para producción.
 * - Fallback local: localhost.
 */
export function getWebAuthnConfig(request?: Request) {
  const envRpID = process.env.WEBAUTHN_RP_ID?.trim();
  const envOrigin =
    process.env.WEBAUTHN_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  let rpID: string | undefined;
  let origin: string | undefined;

  // En desarrollo, el Origin del browser manda (localhost vs IP de red).
  // En producción, las env tienen prioridad.
  const preferRequest = process.env.NODE_ENV !== 'production';

  if (request) {
    const headerOrigin = request.headers.get('origin')?.trim();
    if (headerOrigin) {
      try {
        const o = new URL(headerOrigin);
        origin = o.origin;
        rpID = o.hostname;
      } catch {
        /* ignore */
      }
    }
    if (!rpID || !origin) {
      try {
        const url = new URL(request.url);
        const hostHeader =
          request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
          request.headers.get('host')?.trim() ||
          url.host;
        const hostname = hostHeader.replace(/:\d+$/, '');
        const proto =
          request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
          url.protocol.replace(':', '') ||
          'http';
        if (!rpID && hostname) rpID = hostname;
        if (!origin && hostname) {
          origin = hostHeader.includes(':')
            ? `${proto}://${hostHeader}`
            : `${proto}://${hostname}`;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!preferRequest) {
    if (envRpID) rpID = envRpID;
    if (envOrigin) origin = envOrigin;
  } else {
    if (!rpID && envRpID) rpID = envRpID;
    if (!origin && envOrigin) origin = envOrigin;
  }

  if (!rpID) {
    rpID = process.env.NODE_ENV === 'production' ? undefined : 'localhost';
  }
  if (!origin) {
    origin =
      process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000';
  }

  if (!rpID || !origin) {
    throw new Error(
      'Configurá WEBAUTHN_RP_ID y WEBAUTHN_ORIGIN (ej. dominio sin https y https://tu-dominio.com).',
    );
  }

  return {
    rpID,
    origin,
    rpName: 'LC Traslados Especiales',
  };
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Falta AUTH_SECRET.');
  return new TextEncoder().encode(secret);
}

type ChallengePayload = {
  challenge: string;
  type: 'register' | 'login';
  userId?: string;
  /** Host con el que se generó el challenge (para verificar origin/rpID). */
  rpID?: string;
  origin?: string;
};

export async function setWebAuthnChallengeCookie(payload: ChallengePayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });
}

export async function consumeWebAuthnChallengeCookie(): Promise<ChallengePayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHALLENGE_COOKIE)?.value;
  cookieStore.delete(CHALLENGE_COOKIE);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.challenge !== 'string') return null;
    if (payload.type !== 'register' && payload.type !== 'login') return null;
    return {
      challenge: payload.challenge,
      type: payload.type,
      userId: typeof payload.userId === 'string' ? payload.userId : undefined,
      rpID: typeof payload.rpID === 'string' ? payload.rpID : undefined,
      origin: typeof payload.origin === 'string' ? payload.origin : undefined,
    };
  } catch {
    return null;
  }
}

export function transportsFromDb(
  transports: string[],
): AuthenticatorTransportFuture[] | undefined {
  if (!transports.length) return undefined;
  return transports as AuthenticatorTransportFuture[];
}

export type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON };
