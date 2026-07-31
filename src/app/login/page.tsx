'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { siteConfig } from '@/config/site.config';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
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
        <p className="auth-card__text">Ingresá con el usuario que te asignó el administrador.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
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
              required
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
