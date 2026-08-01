'use client';

import { useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';

type Contacto = { id: string; relacion: string; telefono: string };

type FichaData = {
  id: string;
  nombre: string;
  dni: string | null;
  contactos: Contacto[];
};

function telHref(telefono: string): string {
  const digits = telefono.replace(/[^\d+]/g, '');
  return `tel:${digits || telefono.trim()}`;
}

export function PasajeroContactoModal({
  grillaId,
  pasajeroId,
  pasajeroNombre,
  onClose,
}: {
  grillaId: string;
  pasajeroId: string;
  pasajeroNombre: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<FichaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/operativo/pasajeros/${pasajeroId}?grillaId=${encodeURIComponent(grillaId)}`,
      );
      if (!response.ok) {
        setError(await readApiError(response, 'No se pudo cargar la ficha.'));
        setData(null);
        return;
      }
      const body = await response.json();
      setData(body.data as FichaData);
    } catch {
      setError('Error de conexión al cargar la ficha.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [grillaId, pasajeroId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="panel-popup" role="presentation" onClick={onClose}>
      <div
        className="panel-popup__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pasajero-ficha-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="pasajero-ficha-titulo" className="panel-popup__title">
          {data?.nombre ?? pasajeroNombre}
        </h3>

        {loading ? (
          <p className="panel-popup__message">Cargando ficha...</p>
        ) : error ? (
          <p className="panel-popup__message">{error}</p>
        ) : data ? (
          <div className="pasajero-contacto-modal">
            <dl className="pasajero-contacto-modal__datos">
              <div>
                <dt>DNI</dt>
                <dd>{data.dni?.trim() || 'Sin DNI cargado'}</dd>
              </div>
            </dl>

            <h4 className="pasajero-contacto-modal__subtitulo">Contactos</h4>
            {data.contactos.length === 0 ? (
              <p className="panel-card__desc">Sin contactos cargados.</p>
            ) : (
              <ul className="pasajero-contacto-modal__list">
                {data.contactos.map((c) => (
                  <li key={c.id}>
                    <strong>{c.relacion}</strong>
                    <a href={telHref(c.telefono)}>{c.telefono}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="panel-popup__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
