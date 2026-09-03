'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { siteConfig } from '@/config/site.config';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  useEffect(() => {
    setBioSupported(typeof window !== 'undefined' && !!window.PublicKeyCredential);
    try {
      const saved = localStorage.getItem('lc_last_username');
      if (saved) setUsername(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Ingresá usuario y contraseña.');
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json()) as { message?: string; redirectTo?: string };

      if (!response.ok) {
        setError(data.message ?? 'No pudimos iniciar sesión.');
        return;
      }

      try {
        localStorage.setItem('lc_last_username', username.trim());
      } catch {
        /* ignore */
      }

      router.push(data.redirectTo ?? '/');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setError(null);
    setBioLoading(true);
    try {
      const optRes = await fetch('/api/auth/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() || undefined }),
      });
      const optBody = (await optRes.json()) as {
        message?: string;
        data?: PublicKeyCredentialRequestOptionsJSON;
      };
      if (!optRes.ok || !optBody.data) {
        setError(
          optBody.message ??
            'No se pudo iniciar con huella. Si es la primera vez, ingresá con contraseña y activá la huella desde el panel.',
        );
        return;
      }

      const assertion = await startAuthentication({ optionsJSON: optBody.data });
      const verifyRes = await fetch('/api/auth/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      });
      const verifyBody = (await verifyRes.json()) as {
        message?: string;
        redirectTo?: string;
        user?: { username: string };
      };
      if (!verifyRes.ok) {
        setError(verifyBody.message ?? 'No se pudo verificar la huella.');
        return;
      }
      if (verifyBody.user?.username) {
        try {
          localStorage.setItem('lc_last_username', verifyBody.user.username);
        } catch {
          /* ignore */
        }
      }
      router.push(verifyBody.redirectTo ?? '/');
      router.refresh();
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        setError('Inicio con huella cancelado.');
      } else if (name === 'SecurityError' || name === 'NotSupportedError') {
        setError(
          'Este navegador o dirección no permiten biometría. Entrá con http://localhost:3000 (no por IP de red), o registrá de nuevo la huella desde el panel en esa misma dirección.',
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo usar la huella. Probá con usuario y contraseña.',
        );
      }
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          <Image
            src={siteConfig.logoSrc}
            alt={siteConfig.name}
            width={112}
            height={112}
            priority
          />
        </div>
        <p className="auth-card__tag">Acceso interno</p>
        <h1 className="auth-card__title">Iniciar sesión</h1>
        <p className="auth-card__text">
          Ingresá con el usuario asignado, o con huella / Face ID si ya lo activaste en este
          dispositivo.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="form-feedback form-feedback--error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--full" disabled={loading || bioLoading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {bioSupported && (
          <div className="auth-bio">
            <button
              type="button"
              className="btn btn--outline btn--full"
              disabled={loading || bioLoading}
              onClick={() => void handleBiometric()}
            >
              {bioLoading ? 'Esperando huella…' : 'Ingresar con huella / Face ID'}
            </button>
            <p className="auth-card__text" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Si es la primera vez: ingresá con contraseña y, dentro del panel, activá la huella.
            </p>
          </div>
        )}

        <p className="auth-card__back">
          <Link href="/">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
