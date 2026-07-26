'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import { PasajeroHistorialView } from '@/components/panel/PasajeroHistorialView';

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
  const popup = usePanelPopup();
  const [items, setItems] = useState<Pasajero[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nombre: '', direccion: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', direccion: '' });
  const [filters, setFilters] = useState({ nombre: '', direccion: '', zona: '' });
  const [historialId, setHistorialId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/pasajeros');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar.');
        return;
      }
      setItems(body.data as Pasajero[]);
    } catch {
      popup.error('Error de conexión. Revisá tu internet o que el servidor esté en marcha.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ nombre: '', direccion: '' });
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    const missing = missingFieldsMessage(
      { nombre: form.nombre, direccion: form.direccion },
      { nombre: 'nombre del pasajero', direccion: 'dirección' },
    );
    if (missing) {
      popup.error(missing);
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
        popup.error(await readApiError(response, 'No se pudo crear el pasajero.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      setForm({ nombre: '', direccion: '' });
      popup.success(body.message ?? 'Creado.');
      await load();
    } catch {
      popup.error('Error de conexión. Revisá tu internet o que el servidor esté en marcha.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const missing = missingFieldsMessage(
      { nombre: editForm.nombre, direccion: editForm.direccion },
      { nombre: 'nombre del pasajero', direccion: 'dirección' },
    );
    if (missing) {
      popup.error(missing);
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
        popup.error(await readApiError(response, 'No se pudo actualizar el pasajero.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Pasajero actualizado.');
      cancelEdit();
      await load();
    } catch {
      popup.error('Error de conexión. Revisá tu internet o que el servidor esté en marcha.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item: Pasajero) => {
    const response = await fetch(`/api/admin/pasajeros/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo actualizar el pasajero.'));
      return;
    }
    await load();
  };

  const handleDelete = async (item: Pasajero) => {
    const ok = await popup.confirm({
      message: `¿Eliminar al pasajero "${item.nombre}"?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/pasajeros/${item.id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar el pasajero.'));
      return;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Eliminado.');
    if (editingId === item.id) cancelEdit();
    await load();
  };

  const clearFilters = () => setFilters({ nombre: '', direccion: '', zona: '' });
  const hasFilters = Boolean(filters.nombre || filters.direccion || filters.zona);

  if (historialId) {
    return (
      <PasajeroHistorialView
        pasajeroId={historialId}
        onBack={() => setHistorialId(null)}
      />
    );
  }

  return (
    <div className="admin-section">
      {popup.popupNode}
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
                                className="btn btn--primary btn--sm"
                                onClick={() => setHistorialId(item.id)}
                              >
                                Historial
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
