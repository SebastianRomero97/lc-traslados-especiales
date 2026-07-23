'use client';

import { useCallback, useEffect, useState } from 'react';

type TransporteOption = { id: string; nombre: string; tipo: string };

type Chofer = {
  id: string;
  username: string;
  active: boolean;
  transporteId: string | null;
  transporte: TransporteOption | null;
};

export function AdminChoferesManager() {
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportes, setTransportes] = useState<TransporteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/choferes');
      const body = await response.json();
      if (!response.ok) {
        setFeedback({ type: 'error', message: body.message ?? 'No se pudieron cargar.' });
        return;
      }
      setChoferes(body.data.choferes as Chofer[]);
      setTransportes(body.data.transportes as TransporteOption[]);
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignTransporte = async (choferId: string, transporteId: string) => {
    setFeedback(null);
    const response = await fetch(`/api/admin/choferes/${choferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transporteId: transporteId === '' ? null : transporteId }),
    });
    const body = await response.json();
    if (!response.ok) {
      setFeedback({ type: 'error', message: body.message ?? 'No se pudo asignar.' });
      return;
    }
    setFeedback({ type: 'success', message: body.message ?? 'Asignación actualizada.' });
    await load();
  };

  return (
    <div className="admin-section">
      <section className="panel-card">
        <h2>Choferes y vehículos</h2>
        <p className="panel-card__desc">
          Primero creá el usuario con entidad Chofer en la pestaña Usuarios. Acá le asignás el
          transporte.
        </p>

        {feedback && (
          <p className={`form-feedback form-feedback--${feedback.type}`}>{feedback.message}</p>
        )}

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
                    <td>{chofer.active ? 'Activo' : 'Inactivo'}</td>
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
