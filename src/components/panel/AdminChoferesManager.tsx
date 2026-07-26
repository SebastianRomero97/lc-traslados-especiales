'use client';

import { useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type TransporteOption = { id: string; nombre: string; tipo: string };

type Chofer = {
  id: string;
  username: string;
  active: boolean;
  transporteId: string | null;
  transporte: TransporteOption | null;
};

export function AdminChoferesManager() {
  const popup = usePanelPopup();
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportes, setTransportes] = useState<TransporteOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/choferes');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar los choferes.');
        return;
      }
      setChoferes(body.data.choferes as Chofer[]);
      setTransportes(body.data.transportes as TransporteOption[]);
    } catch {
      popup.error('Error de conexión. Revisá tu internet o que el servidor esté en marcha.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignTransporte = async (choferId: string, transporteId: string) => {
    const response = await fetch(`/api/admin/choferes/${choferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transporteId: transporteId === '' ? null : transporteId }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo asignar el transporte.'));
      return;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Asignación actualizada.');
    await load();
  };

  return (
    <div className="admin-section">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Choferes y vehículos</h2>
        <p className="panel-card__desc">
          Primero creá el usuario con entidad Chofer en la pestaña Usuarios. Acá le asignás el
          transporte.
        </p>

        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : choferes.length === 0 ? (
          <p className="panel-card__desc">
            No hay choferes todavía. Creá uno en Usuarios con entidad Chofer.
          </p>
        ) : (
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>Chofer</th>
                  <th>Estado</th>
                  <th>Transporte asignado</th>
                </tr>
              </thead>
              <tbody>
                {choferes.map((chofer) => (
                  <tr key={chofer.id}>
                    <td>{chofer.username}</td>
                    <td>{chofer.active ? 'Activo' : 'No disponible'}</td>
                    <td>
                      <select
                        className="admin-inline-select"
                        value={chofer.transporteId ?? ''}
                        onChange={(e) => void assignTransporte(chofer.id, e.target.value)}
                      >
                        <option value="">Sin asignar</option>
                        {transportes.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.nombre} ({tr.tipo})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
