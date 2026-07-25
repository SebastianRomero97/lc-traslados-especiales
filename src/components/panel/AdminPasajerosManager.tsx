'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';

type Pasajero = {
  id: string;
  nombre: string;
  direccion: string;
  active: boolean;
};

export function AdminPasajerosManager() {
  const [items, setItems] = useState<Pasajero[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [form, setForm] = useState({ nombre: '', direccion: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/pasajeros');
      const body = await response.json();
      if (!response.ok) {
        setFeedback({ type: 'error', message: body.message ?? 'No se pudieron cargar.' });
        return;
      }
      setItems(body.data as Pasajero[]);
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
      { nombre: form.nombre, direccion: form.direccion },
      { nombre: 'nombre del pasajero', direccion: 'dirección' },
    );
    if (missing) {
      setFeedback({ type: 'error', message: missing });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/pasajeros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: await readApiError(response, 'No se pudo crear el pasajero.'),
        });
        return;
      }
      const body = (await response.json()) as { message?: string };
      setForm({ nombre: '', direccion: '' });
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

  const toggleActive = async (item: Pasajero) => {
    setFeedback(null);
    const response = await fetch(`/api/admin/pasajeros/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo actualizar el pasajero.'),
      });
      return;
    }
    await load();
  };

  const handleDelete = async (item: Pasajero) => {
    if (!window.confirm(`¿Eliminar al pasajero "${item.nombre}"?`)) return;
    setFeedback(null);
    const response = await fetch(`/api/admin/pasajeros/${item.id}`, { method: 'DELETE' });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo eliminar el pasajero.'),
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
        <h2>Crear pasajero</h2>
        <p className="panel-card__desc">Nombre y dirección (lo más precisa posible).</p>
        <form className="admin-grid-form admin-grid-form--2" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="pas-nombre">Nombre</label>
            <input
              id="pas-nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="pas-dir">Dirección</label>
            <input
              id="pas-dir"
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              placeholder="Calle, número, localidad"
              required
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
        <h2>Pasajeros</h2>
        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="panel-card__desc">Todavía no hay pasajeros.</p>
        ) : (
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombre}</td>
                    <td>{item.direccion}</td>
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
