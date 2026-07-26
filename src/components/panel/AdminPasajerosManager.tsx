'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';

type Pasajero = {
  id: string;
  nombre: string;
  direccion: string;
  active: boolean;
};

/** Localidad al final de la dirección (después de la última coma). */
function extractZona(direccion: string): string {
  const parts = direccion.split(',');
  if (parts.length < 2) return '';
  return parts[parts.length - 1]?.trim() ?? '';
}

export function AdminPasajerosManager() {
  const [items, setItems] = useState<Pasajero[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [form, setForm] = useState({ nombre: '', direccion: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', direccion: '' });
  const [filters, setFilters] = useState({ nombre: '', direccion: '', zona: '' });

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
      setFeedback({
        type: 'error',
        message: 'Error de conexión. Revisá tu internet o que el servidor esté en marcha.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const zonas = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const zona = extractZona(item.direccion);
      if (zona) set.add(zona);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const filtered = useMemo(() => {
    const nombreQ = filters.nombre.trim().toLowerCase();
    const dirQ = filters.direccion.trim().toLowerCase();
    const zonaQ = filters.zona.trim().toLowerCase();

    return items.filter((item) => {
      if (nombreQ && !item.nombre.toLowerCase().includes(nombreQ)) return false;
      if (dirQ && !item.direccion.toLowerCase().includes(dirQ)) return false;
      if (zonaQ) {
        const zona = extractZona(item.direccion).toLowerCase();
        if (zona !== zonaQ) return false;
      }
      return true;
    });
  }, [items, filters]);

  const startEdit = (item: Pasajero) => {
    setEditingId(item.id);
    setEditForm({ nombre: item.nombre, direccion: item.direccion });
    setFeedback(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ nombre: '', direccion: '' });
  };

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

  const handleSaveEdit = async (id: string) => {
    setFeedback(null);
    const missing = missingFieldsMessage(
      { nombre: editForm.nombre, direccion: editForm.direccion },
      { nombre: 'nombre del pasajero', direccion: 'dirección' },
    );
    if (missing) {
      setFeedback({ type: 'error', message: missing });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/pasajeros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editForm.nombre,
          direccion: editForm.direccion,
        }),
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: await readApiError(response, 'No se pudo actualizar el pasajero.'),
        });
        return;
      }
      const body = (await response.json()) as { message?: string };
      setFeedback({ type: 'success', message: body.message ?? 'Pasajero actualizado.' });
      cancelEdit();
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
    if (editingId === item.id) cancelEdit();
    await load();
  };

  const clearFilters = () => setFilters({ nombre: '', direccion: '', zona: '' });
  const hasFilters = Boolean(filters.nombre || filters.direccion || filters.zona);

  return (
    <div className="admin-section">
      <section className="panel-card">
        <h2>Crear pasajero</h2>
        <p className="panel-card__desc">
          Nombre y dirección (lo más precisa posible). Tip: incluí la localidad al final, después de
          una coma (ej. “…, San Miguel”) para poder filtrar por zona.
        </p>
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

        {!loading && items.length > 0 && (
          <div className="admin-filters">
            <div className="form-group">
              <label htmlFor="filtro-nombre">Buscar por nombre</label>
              <input
                id="filtro-nombre"
                value={filters.nombre}
                onChange={(e) => setFilters((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej. Mateo"
              />
            </div>
            <div className="form-group">
              <label htmlFor="filtro-dir">Buscar por dirección</label>
              <input
                id="filtro-dir"
                value={filters.direccion}
                onChange={(e) => setFilters((p) => ({ ...p, direccion: e.target.value }))}
                placeholder="Ej. Rivadavia"
              />
            </div>
            <div className="form-group">
              <label htmlFor="filtro-zona">Zona / localidad</label>
              <select
                id="filtro-zona"
                value={filters.zona}
                onChange={(e) => setFilters((p) => ({ ...p, zona: e.target.value }))}
              >
                <option value="">Todas</option>
                {zonas.map((zona) => (
                  <option key={zona} value={zona}>
                    {zona}
                  </option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button type="button" className="btn btn--outline btn--sm" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="panel-card__desc">Todavía no hay pasajeros.</p>
        ) : filtered.length === 0 ? (
          <p className="panel-card__desc">
            No hay pasajeros que coincidan con el filtro.
            {hasFilters && (
              <>
                {' '}
                <button type="button" className="btn btn--outline btn--sm" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              </>
            )}
          </p>
        ) : (
          <>
            <p className="panel-card__desc">
              Mostrando {filtered.length} de {items.length} pasajero
              {items.length === 1 ? '' : 's'}.
            </p>
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
                  {filtered.map((item) => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr key={item.id} className={isEditing ? 'is-selected' : undefined}>
                        <td>
                          {isEditing ? (
                            <input
                              value={editForm.nombre}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, nombre: e.target.value }))
                              }
                              aria-label="Nombre"
                            />
                          ) : (
                            item.nombre
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              value={editForm.direccion}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, direccion: e.target.value }))
                              }
                              aria-label="Dirección"
                            />
                          ) : (
                            item.direccion
                          )}
                        </td>
                        <td>{item.active ? 'Activo' : 'Inactivo'}</td>
                        <td className="admin-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                disabled={submitting}
                                onClick={() => void handleSaveEdit(item.id)}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                disabled={submitting}
                                onClick={cancelEdit}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => startEdit(item)}
                              >
                                Editar
                              </button>
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
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
