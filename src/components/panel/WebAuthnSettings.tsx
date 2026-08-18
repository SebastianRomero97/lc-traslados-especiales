'use client';

import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type CredRow = {
  id: string;
  label: string | null;
  deviceType: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

function webAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export function WebAuthnSettings() {
  const popup = usePanelPopup();
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<CredRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/webauthn/credentials');
      if (!res.ok) {
        popup.error(await readApiError(res, 'No se pudieron cargar las huellas.'));
        return;
      }
      const body = (await res.json()) as { data: CredRow[] };
      setCreds(body.data);
    } catch {
      popup.error('Error de conexión al cargar huellas.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSupported(webAuthnSupported());
    void load();
  }, [load]);

  const register = async () => {
    if (!supported) {
      popup.error('Este navegador o dispositivo no soporta huella / Face ID.');
      return;
    }
    setBusy(true);
    try {
      const optRes = await fetch('/api/auth/webauthn/register');
      if (!optRes.ok) {
        popup.error(await readApiError(optRes, 'No se pudo iniciar el registro.'));
        return;
      }
      const optBody = (await optRes.json()) as {
        data: PublicKeyCredentialCreationOptionsJSON;
      };
      const attestation = await startRegistration({ optionsJSON: optBody.data });
      const saveRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: attestation,
          label: 'Este dispositivo',
        }),
      });
      if (!saveRes.ok) {
        popup.error(await readApiError(saveRes, 'No se pudo guardar la huella.'));
        return;
      }
      const saveBody = (await saveRes.json()) as { message?: string };
      popup.success(saveBody.message ?? 'Huella activada.');
      await load();
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        popup.error('Registro cancelado o no permitido en este dispositivo.');
      } else {
        popup.error(
          err instanceof Error ? err.message : 'No se pudo registrar la huella.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await popup.confirm({
      title: 'Quitar huella',
      message: '¿Eliminar el acceso biométrico de este registro?',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/webauthn/credentials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        popup.error(await readApiError(res, 'No se pudo eliminar.'));
        return;
      }
      popup.success('Huella eliminada.');
      await load();
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="panel-card panel-card--nested webauthn-settings">
      {popup.popupNode}
      <summary className="webauthn-settings__summary">
        <strong>Huella / Face ID</strong>
        <span>
          {creds.length > 0
            ? `${creds.length} dispositivo${creds.length === 1 ? '' : 's'} activo${creds.length === 1 ? '' : 's'}`
            : 'Activar acceso rápido en este dispositivo'}
        </span>
      </summary>
      <p className="panel-card__desc">
        Activá el desbloqueo biométrico en este celular o computadora. La primera vez tenés que
        estar logueado con usuario y contraseña.
      </p>
      {!supported && (
        <p className="form-feedback form-feedback--error">
          Este dispositivo no soporta WebAuthn (huella / Face ID). Probá con Chrome o Safari en
          HTTPS.
        </p>
      )}
      <div className="admin-actions" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!supported || busy}
          onClick={() => void register()}
        >
          {busy ? 'Esperando…' : 'Activar huella en este dispositivo'}
        </button>
      </div>
      {loading ? (
        <p className="panel-card__desc">Cargando…</p>
      ) : creds.length === 0 ? (
        <p className="panel-card__desc">Todavía no hay huellas registradas en tu cuenta.</p>
      ) : (
        <ul className="webauthn-settings__list">
          {creds.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.label || 'Dispositivo'}</strong>
                <small>
                  Alta: {new Date(c.createdAt).toLocaleString('es-AR')}
                  {c.lastUsedAt
                    ? ` · Último uso: ${new Date(c.lastUsedAt).toLocaleString('es-AR')}`
                    : ''}
                </small>
              </div>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={busy}
                onClick={() => void remove(c.id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
