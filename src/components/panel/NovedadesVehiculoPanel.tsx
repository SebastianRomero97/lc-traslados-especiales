'use client';

import { useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import { labelEstadoNovedad } from '@/lib/transporte.utils';

type Novedad = {
  id: string;
  mensaje: string;
  estado: 'PENDIENTE_REVISION' | 'RESUELTO';
  detalleAdmin: string | null;
  createdAt: string;
  updatedAt: string;
  transporte: { id: string; nombre: string; tipo: string };
  reportadoPor: { id: string; username: string };
};

export function NovedadesVehiculoPanel() {
  const popup = usePanelPopup();
  const [items, setItems] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleDraft, setDetalleDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/novedades-vehiculo');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar las novedades.');
        return;
      }
      setItems(body.data as Novedad[]);
    } catch {
      popup.error('Error de conexión al cargar novedades.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateNovedad = async (
    id: string,
    patch: { estado?: 'PENDIENTE_REVISION' | 'RESUELTO'; detalleAdmin?: string | null },
  ) => {
    try {
      const response = await fetch('/api/novedades-vehiculo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo actualizar la novedad.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Novedad actualizada.');
      await load();
    } catch {
      popup.error('Error de conexión al actualizar la novedad.');
    }
  };

  return (
    <div className="admin-section">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Novedades de vehículos</h2>
        <p className="panel-card__desc">
          Historial reportado por choferes. Podés marcar estado y dejar un detalle.
        </p>

        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="panel-card__desc">Todavía no hay novedades reportadas.</p>
        ) : (
          <ul className="novedades-vehiculo-list">
            {items.map((item) => (
              <li key={item.id} className="novedades-vehiculo-item">
                <div className="novedades-vehiculo-item__meta">
                  <strong>
                    {item.transporte.nombre} ({item.transporte.tipo}) ·{' '}
                    {labelEstadoNovedad(item.estado)}
                  </strong>
                  <span>
                    {item.reportadoPor.username} ·{' '}
                    {new Date(item.createdAt).toLocaleString('es-AR')}
                  </span>
                </div>
                <p>{item.mensaje}</p>
                {item.detalleAdmin && (
                  <p className="transporte-ficha__detalle">Admin: {item.detalleAdmin}</p>
                )}
                <div className="admin-actions">
                  <button
                    type="button"
                    className={`btn btn--sm${
                      item.estado === 'PENDIENTE_REVISION' ? ' btn--primary' : ' btn--outline'
                    }`}
                    disabled={item.estado === 'PENDIENTE_REVISION'}
                    onClick={() =>
                      void updateNovedad(item.id, { estado: 'PENDIENTE_REVISION' })
                    }
                  >
                    Pendiente de revisión
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm${
                      item.estado === 'RESUELTO' ? ' btn--primary' : ' btn--outline'
                    }`}
                    disabled={item.estado === 'RESUELTO'}
                    onClick={() => void updateNovedad(item.id, { estado: 'RESUELTO' })}
                  >
                    Resuelto
                  </button>
                </div>
                <div className="transporte-ficha__detalle-form">
                  <textarea
                    rows={2}
                    placeholder="Detalle / comentario del Admin"
                    value={detalleDraft[item.id] ?? item.detalleAdmin ?? ''}
                    onChange={(e) =>
                      setDetalleDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() =>
                      void updateNovedad(item.id, {
                        detalleAdmin: detalleDraft[item.id] ?? item.detalleAdmin,
                      })
                    }
                  >
                    Guardar detalle
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
