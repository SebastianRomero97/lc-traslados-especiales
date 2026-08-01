'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import { PasajeroFichaHistorial } from '@/components/panel/PasajeroFichaHistorial';
import {
  dateToInput,
  edadDesdeCumpleanos,
  labelEstadoAsistenciaResumen,
  type ResumenAsistencias,
} from '@/lib/pasajero.utils';

type Contacto = { id?: string; relacion: string; telefono: string };

type AreaAsignada = {
  id: string;
  nombre: string;
  active: boolean;
  destinos: { id: string; nombre: string; domicilio: string; active: boolean }[];
};

type Pasajero = {
  id: string;
  nombre: string;
  direccion: string;
  dni: string | null;
  fechaCumpleanos: string | null;
  edad: number | null;
  edadCalculada: number | null;
  edadMostrada: number | null;
  active: boolean;
  contactos: Contacto[];
  areas: AreaAsignada[];
  asistencia: ResumenAsistencias;
};

type FichaForm = {
  nombre: string;
  direccion: string;
  dni: string;
  fechaCumpleanos: string;
  edad: string;
  contactos: Contacto[];
};

/** Localidad al final de la dirección (después de la última coma). */
function extractZona(direccion: string): string {
  const parts = direccion.split(',');
  if (parts.length < 2) return '';
  return parts[parts.length - 1]?.trim() ?? '';
}

function toFicha(item: Pasajero): FichaForm {
  const edadCalc = edadDesdeCumpleanos(item.fechaCumpleanos) ?? item.edadCalculada;
  return {
    nombre: item.nombre,
    direccion: item.direccion,
    dni: item.dni ?? '',
    fechaCumpleanos: dateToInput(item.fechaCumpleanos),
    edad: (edadCalc ?? item.edad)?.toString() ?? '',
    contactos:
      item.contactos.length > 0
        ? item.contactos.map((c) => ({
            id: c.id,
            relacion: c.relacion,
            telefono: c.telefono,
          }))
        : [],
  };
}

function emptyContacto(): Contacto {
  return { relacion: '', telefono: '' };
}

export function AdminPasajerosManager() {
  const popup = usePanelPopup();
  const [items, setItems] = useState<Pasajero[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nombre: '', direccion: '' });
  const [filters, setFilters] = useState({ nombre: '', direccion: '', zona: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaForm | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/pasajeros');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar.');
        return;
      }
      const list = body.data as Pasajero[];
      setItems(list);
      setExpandedId((cur) => {
        if (!cur) return cur;
        const found = list.find((p) => p.id === cur);
        if (found) setFicha(toFicha(found));
        return cur;
      });
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
      const body = (await response.json()) as { message?: string; data?: Pasajero };
      setForm({ nombre: '', direccion: '' });
      popup.success(body.message ?? 'Creado.');
      await load();
      if (body.data?.id) {
        setExpandedId(body.data.id);
        setFicha(toFicha(body.data));
      }
    } catch {
      popup.error('Error de conexión. Revisá tu internet o que el servidor esté en marcha.');
    } finally {
      setSubmitting(false);
    }
  };

  const openFicha = (item: Pasajero) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setFicha(null);
      return;
    }
    setExpandedId(item.id);
    setFicha(toFicha(item));
  };

  const saveFicha = async (id: string) => {
    if (!ficha) return;

    const missing = missingFieldsMessage(
      { nombre: ficha.nombre, direccion: ficha.direccion },
      { nombre: 'nombre del pasajero', direccion: 'dirección' },
    );
    if (missing) {
      popup.error(missing);
      return;
    }

    for (const c of ficha.contactos) {
      const rel = c.relacion.trim();
      const tel = c.telefono.trim();
      if ((rel && !tel) || (!rel && tel)) {
        popup.error('Cada contacto necesita relación y teléfono.');
        return;
      }
    }

    setSavingId(id);
    try {
      const response = await fetch(`/api/admin/pasajeros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: ficha.nombre,
          direccion: ficha.direccion,
          dni: ficha.dni.trim() || null,
          fechaCumpleanos: ficha.fechaCumpleanos || null,
          edad: ficha.edad === '' ? null : Number(ficha.edad),
          contactos: ficha.contactos
            .filter((c) => c.relacion.trim() && c.telefono.trim())
            .map((c) => ({
              relacion: c.relacion.trim(),
              telefono: c.telefono.trim(),
            })),
        }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo guardar la ficha.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Ficha guardada.');
      await load();
    } catch {
      popup.error('Error de conexión al guardar la ficha.');
    } finally {
      setSavingId(null);
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
    popup.success(item.active ? 'Pasajero desactivado.' : 'Pasajero activado.');
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
    if (expandedId === item.id) {
      setExpandedId(null);
      setFicha(null);
    }
    await load();
  };

  const clearFilters = () => setFilters({ nombre: '', direccion: '', zona: '' });
  const hasFilters = Boolean(filters.nombre || filters.direccion || filters.zona);

  const edadPreview = ficha
    ? edadDesdeCumpleanos(ficha.fechaCumpleanos || null)
    : null;

  return (
    <div className="admin-section">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Crear pasajero</h2>
        <p className="panel-card__desc">
          Solo nombre y dirección (lo más precisa posible). El resto se completa en la ficha. Tip:
          incluí la localidad al final, después de una coma (ej. “…, San Miguel”) para filtrar por
          zona.
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
            <ul className="transporte-fichas">
              {filtered.map((item) => {
                const open = expandedId === item.id;
                const edadLabel = item.edadMostrada != null ? `${item.edadMostrada} años` : null;
                return (
                  <li key={item.id} className={`transporte-ficha${open ? ' is-open' : ''}`}>
                    <div className="transporte-ficha__head">
                      <div>
                        <strong>
                          {item.nombre}
                          {edadLabel ? <span> · {edadLabel}</span> : null}
                        </strong>
                        <p className="panel-card__desc" style={{ margin: '0.2rem 0 0' }}>
                          {item.direccion}
                          {item.dni ? ` · DNI ${item.dni}` : ''}
                          {' · '}
                          {item.active ? 'Activo' : 'Inactivo'}
                        </p>
                      </div>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => openFicha(item)}
                        >
                          {open ? 'Cerrar ficha' : 'Abrir ficha'}
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
                      </div>
                    </div>

                    {open && ficha && (
                      <div className="transporte-ficha__body">
                        <h3>Datos del pasajero</h3>
                        <div className="admin-grid-form admin-grid-form--2">
                          <div className="form-group">
                            <label>Nombre</label>
                            <input
                              value={ficha.nombre}
                              onChange={(e) =>
                                setFicha((p) => (p ? { ...p, nombre: e.target.value } : p))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label>DNI</label>
                            <input
                              value={ficha.dni}
                              onChange={(e) =>
                                setFicha((p) => (p ? { ...p, dni: e.target.value } : p))
                              }
                              placeholder="Opcional"
                            />
                          </div>
                          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Dirección</label>
                            <input
                              value={ficha.direccion}
                              onChange={(e) =>
                                setFicha((p) => (p ? { ...p, direccion: e.target.value } : p))
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label>Fecha de cumpleaños</label>
                            <input
                              type="date"
                              value={ficha.fechaCumpleanos}
                              onChange={(e) => {
                                const value = e.target.value;
                                setFicha((p) => {
                                  if (!p) return p;
                                  const calc = edadDesdeCumpleanos(value || null);
                                  return {
                                    ...p,
                                    fechaCumpleanos: value,
                                    edad: calc != null ? String(calc) : p.edad,
                                  };
                                });
                              }}
                            />
                          </div>
                          <div className="form-group">
                            <label>Edad</label>
                            <input
                              type="number"
                              min={0}
                              max={149}
                              value={ficha.edad}
                              onChange={(e) =>
                                setFicha((p) => (p ? { ...p, edad: e.target.value } : p))
                              }
                              placeholder="Opcional"
                            />
                            <small className="transporte-ficha__hint">
                              {edadPreview != null
                                ? `Calculada por cumpleaños: ${edadPreview} años (podés ajustarla).`
                                : 'Si cargás cumpleaños, se calcula sola.'}
                            </small>
                          </div>
                        </div>

                        <h3 className="transporte-ficha__hist-title">Área y destinos</h3>
                        {item.areas.length === 0 ? (
                          <p className="panel-card__desc">
                            Sin asignaciones actuales. Se gestionan desde Áreas.
                          </p>
                        ) : (
                          <ul className="transporte-ficha__novedades">
                            {item.areas.map((area) => (
                              <li key={area.id}>
                                <strong>
                                  {area.nombre}
                                  {!area.active ? ' (inactiva)' : ''}
                                </strong>
                                {area.destinos.length === 0 ? (
                                  <p className="panel-card__desc" style={{ margin: '0.25rem 0 0' }}>
                                    Sin destinos habituales.
                                  </p>
                                ) : (
                                  <p className="panel-card__desc" style={{ margin: '0.25rem 0 0' }}>
                                    {area.destinos
                                      .map((d) => d.nombre)
                                      .join(' · ')}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        <h3 className="transporte-ficha__hist-title">Historial de asistencias</h3>
                        <p className="panel-card__desc">
                          {item.asistencia.total === 0
                            ? 'Resumen: sin registros todavía.'
                            : `Resumen: ${labelEstadoAsistenciaResumen(item.asistencia)}`}
                        </p>
                        <PasajeroFichaHistorial
                          pasajeroId={item.id}
                          pasajeroNombre={item.nombre}
                        />

                        <h3 className="transporte-ficha__hist-title">Contactos</h3>
                        {ficha.contactos.length === 0 ? (
                          <p className="panel-card__desc">Sin contactos cargados.</p>
                        ) : (
                          <div className="admin-grid-form admin-grid-form--2">
                            {ficha.contactos.map((c, idx) => (
                              <div
                                key={c.id ?? `nuevo-${idx}`}
                                style={{
                                  gridColumn: '1 / -1',
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr auto',
                                  gap: '0.75rem',
                                  alignItems: 'end',
                                }}
                              >
                                <div className="form-group">
                                  <label>Relación</label>
                                  <input
                                    value={c.relacion}
                                    onChange={(e) =>
                                      setFicha((p) => {
                                        if (!p) return p;
                                        const contactos = [...p.contactos];
                                        contactos[idx] = {
                                          ...contactos[idx],
                                          relacion: e.target.value,
                                        };
                                        return { ...p, contactos };
                                      })
                                    }
                                    placeholder="Madre, Padre, Tutor…"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Teléfono</label>
                                  <input
                                    value={c.telefono}
                                    onChange={(e) =>
                                      setFicha((p) => {
                                        if (!p) return p;
                                        const contactos = [...p.contactos];
                                        contactos[idx] = {
                                          ...contactos[idx],
                                          telefono: e.target.value,
                                        };
                                        return { ...p, contactos };
                                      })
                                    }
                                    placeholder="11…"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm"
                                  onClick={() =>
                                    setFicha((p) =>
                                      p
                                        ? {
                                            ...p,
                                            contactos: p.contactos.filter((_, i) => i !== idx),
                                          }
                                        : p,
                                    )
                                  }
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="admin-actions" style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() =>
                              setFicha((p) =>
                                p ? { ...p, contactos: [...p.contactos, emptyContacto()] } : p,
                              )
                            }
                          >
                            Agregar contacto
                          </button>
                        </div>

                        <div className="admin-actions" style={{ marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={savingId === item.id}
                            onClick={() => void saveFicha(item.id)}
                          >
                            {savingId === item.id ? 'Guardando...' : 'Guardar ficha'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
