'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';

type Transporte = {
  id: string;
  nombre: string;
  tipo: string;
  capacidad: number | null;
  active: boolean;
  choferes?: { id: string; username: string }[];
};

export function AdminTransportesManager() {
  const [items, setItems] = useState<Transporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [form, setForm] = useState({ nombre: '', tipo: '', capacidad: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/transportes');
      const body = await response.json();
      if (!response.ok) {
        setFeedback({ type: 'error', message: body.message ?? 'No se pudieron cargar.' });
        return;
      }
      setItems(body.data as Transporte[]);
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexión. Revisá tu internet o que el servidor esté en marcha.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const missing = missingFieldsMessage(
      { nombre: form.nombre, tipo: form.tipo },
      { nombre: 'nombre del transporte', tipo: 'tipo' },
    );
    if (missing) {
      setFeedback({ type: 'error', message: missing });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/transportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          tipo: form.tipo,
          capacidad: form.capacidad === '' ? null : Number(form.capacidad),
        }),
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: await readApiError(response, 'No se pudo crear el transporte.'),
        });
        return;
      }
      const body = (await response.json()) as { message?: string };
      setForm({ nombre: '', tipo: '', capacidad: '' });
      setFeedback({ type: 'success', message: body.message ?? 'Creado.' });
      await load();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Error de conexión. Revisá tu internet o que el servidor esté en marcha.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item: Transporte) => {
    setFeedback(null);
    const response = await fetch(`/api/admin/transportes/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo actualizar el transporte.'),
      });
      return;
    }
    await load();
  };

  const handleDelete = async (item: Transporte) => {
    if (!window.confirm(`¿Eliminar el transporte "${item.nombre}"?`)) return;
    setFeedback(null);
    const response = await fetch(`/api/admin/transportes/${item.id}`, { method: 'DELETE' });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo eliminar el transporte.'),
      });
      return;
    }
    const body = (await response.json()) as { message?: string };
    setFeedback({ type: 'success', message: body.message ?? 'Eliminado.' });
    await load();
  };

  return (
    <div className="admin-section">
      <section className="panel-card">
        <h2>Crear transporte</h2>
        <p className="panel-card__desc">Nombre, tipo y capacidad opcional.</p>
        <form className="admin-grid-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="tr-nombre">Nombre</label>
            <input
              id="tr-nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Arcoíris de Amor"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="tr-tipo">Tipo</label>
            <input
              id="tr-tipo"
              value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
              placeholder="Ej: MASTER / COMBI"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="tr-cap">Capacidad (opcional)</label>
            <input
              id="tr-cap"
              type="number"
              min={1}
              value={form.capacidad}
              onChange={(e) => setForm((p) => ({ ...p, capacidad: e.target.value }))}
              placeholder="Pasajeros"
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear'}
          </button>
        </form>
        {feedback && (
          <p className={`form-feedback form-feedback--${feedback.type}`}>{feedback.message}</p>
        )}
      </section>

      <section className="panel-card">
        <h2>Transportes</h2>
        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="panel-card__desc">Todavía no hay transportes.</p>
        ) : (
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Capacidad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>{item.tipo}</td>
                    <td>{item.capacidad ?? '—'}</td>
                    <td>{item.active ? 'Activo' : 'Inactivo'}</td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => void toggleActive(item)}
                      >
                        {item.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => void handleDelete(item)}
                      >
                        Eliminar
                      </button>
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
