import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';

const CHALLENGE_COOKIE = 'lc_webauthn_challenge';

export function getWebAuthnConfig() {
  const rpID =
    process.env.WEBAUTHN_RP_ID?.trim() ||
    (process.env.NODE_ENV === 'production' ? undefined : 'localhost');
  const origin =
    process.env.WEBAUTHN_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000');

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
