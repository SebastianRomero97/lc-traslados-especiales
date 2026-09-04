'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { siteConfig } from '@/config/site.config';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
        <p className="auth-card__text">Ingresá con el usuario y la contraseña asignados.</p>

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

          <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="auth-card__back">
          <Link href="/">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
