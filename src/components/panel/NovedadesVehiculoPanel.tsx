'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type Novedad = {
  id: string;
  mensaje: string;
  createdAt: string;
  transporte: { id: string; nombre: string; tipo: string };
  reportadoPor: { id: string; username: string };
};

export function NovedadesVehiculoPanel() {
  const popup = usePanelPopup();
  const [items, setItems] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="admin-section">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Novedades de vehículos</h2>
        <p className="panel-card__desc">
          Avisos enviados por los choferes sobre el estado de sus vehículos.
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
                    {item.transporte.nombre} ({item.transporte.tipo})
                  </strong>
                  <span>
                    {item.reportadoPor.username} ·{' '}
                    {new Date(item.createdAt).toLocaleString('es-AR')}
                  </span>
                </div>
                <p>{item.mensaje}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
