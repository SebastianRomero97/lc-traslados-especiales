'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import {
  dateToInput,
  labelEstadoNovedad,
  labelEstadoVtv,
  type EstadoVtv,
} from '@/lib/transporte.utils';

type Novedad = {
  id: string;
  mensaje: string;
  estado: 'PENDIENTE_REVISION' | 'RESUELTO';
  detalleAdmin: string | null;
  createdAt: string;
  updatedAt: string;
  reportadoPor: { id: string; username: string };
};

type Transporte = {
  id: string;
  nombre: string;
  tipo: string;
  capacidad: number | null;
  anio: number | null;
  patente: string | null;
  servicePendiente: string | null;
  serviceFecha: string | null;
  vtvVenceAt: string | null;
  vtvEstado: EstadoVtv;
  active: boolean;
  choferes?: { id: string; username: string }[];
  novedades?: Novedad[];
};

type FichaForm = {
  nombre: string;
  tipo: string;
  capacidad: string;
  anio: string;
  patente: string;
  servicePendiente: string;
  serviceFecha: string;
  vtvVenceAt: string;
};

function toFicha(item: Transporte): FichaForm {
  return {
    nombre: item.nombre,
    tipo: item.tipo,
    capacidad: item.capacidad?.toString() ?? '',
    anio: item.anio?.toString() ?? '',
    patente: item.patente ?? '',
    servicePendiente: item.servicePendiente ?? '',
    serviceFecha: dateToInput(item.serviceFecha),
    vtvVenceAt: dateToInput(item.vtvVenceAt),
  };
}

export function AdminTransportesManager() {
  const popup = usePanelPopup();
  const [items, setItems] = useState<Transporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: '', capacidad: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaForm | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [novedadDetalle, setNovedadDetalle] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/transportes');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar los transportes.');
        return;
      }
      const list = body.data as Transporte[];
      setItems(list);
      setExpandedId((cur) => {
        if (!cur) return cur;
        const found = list.find((t) => t.id === cur);
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

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    const missing = missingFieldsMessage(
      { nombre: form.nombre, tipo: form.tipo },
      { nombre: 'nombre del transporte', tipo: 'tipo' },
    );
    if (missing) {
      popup.error(missing);
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
        popup.error(await readApiError(response, 'No se pudo crear el transporte.'));
        return;
      }
      const body = (await response.json()) as { message?: string; data?: Transporte };
      setForm({ nombre: '', tipo: '', capacidad: '' });
      popup.success(body.message ?? 'Transporte creado.');
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

  const openFicha = (item: Transporte) => {
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
    setSavingId(id);
    try {
      const response = await fetch(`/api/admin/transportes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: ficha.nombre,
          tipo: ficha.tipo,
          capacidad: ficha.capacidad === '' ? null : Number(ficha.capacidad),
          anio: ficha.anio === '' ? null : Number(ficha.anio),
          patente: ficha.patente,
          servicePendiente: ficha.servicePendiente,
          serviceFecha: ficha.serviceFecha || null,
          vtvVenceAt: ficha.vtvVenceAt || null,
        }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo guardar la ficha.'));
        return;
      }
      const body = (await response.json()) as { message?: string; data?: Transporte };
      popup.success(body.message ?? 'Ficha guardada.');
      await load();
    } catch {
      popup.error('Error de conexión al guardar la ficha.');
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (item: Transporte) => {
    const response = await fetch(`/api/admin/transportes/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo actualizar el transporte.'));
      return;
    }
    popup.success(item.active ? 'Transporte desactivado.' : 'Transporte activado.');
    await load();
  };

  const handleDelete = async (item: Transporte) => {
    const ok = await popup.confirm({
      message: `¿Eliminar el transporte "${item.nombre}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;

    const response = await fetch(`/api/admin/transportes/${item.id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar el transporte.'));
      return;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Transporte eliminado.');
    if (expandedId === item.id) {
      setExpandedId(null);
      setFicha(null);
    }
    await load();
  };

  const updateNovedad = async (
    novedadId: string,
    patch: { estado?: 'PENDIENTE_REVISION' | 'RESUELTO'; detalleAdmin?: string | null },
  ) => {
    const response = await fetch('/api/novedades-vehiculo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: novedadId, ...patch }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo actualizar la novedad.'));
      return;
    }
    popup.success('Novedad actualizada.');
    await load();
  };

  return (
    <div className="admin-section">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Crear transporte</h2>
        <p className="panel-card__desc">
          Nombre (ej. Master), tipo (ej. Minibus) y capacidad opcional. El resto se completa en la
          ficha.
        </p>
        <form className="admin-grid-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="tr-nombre">Nombre</label>
            <input
              id="tr-nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Master"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="tr-tipo">Tipo</label>
            <input
              id="tr-tipo"
              value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
              placeholder="Ej: Minibus"
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
      </section>

      <section className="panel-card">
        <h2>Transportes</h2>
        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="panel-card__desc">Todavía no hay transportes.</p>
        ) : (
          <ul className="transporte-fichas">
            {items.map((item) => {
              const open = expandedId === item.id;
              return (
                <li key={item.id} className={`transporte-ficha${open ? ' is-open' : ''}`}>
                  <div className="transporte-ficha__head">
                    <div>
                      <strong>
                        {item.nombre} <span>· {item.tipo}</span>
                      </strong>
                      <p className="panel-card__desc" style={{ margin: '0.2rem 0 0' }}>
                        Capacidad: {item.capacidad ?? '—'}
                        {item.patente ? ` · Patente: ${item.patente}` : ''}
                        {item.vtvVenceAt
                          ? ` · VTV: ${labelEstadoVtv(item.vtvEstado)}`
                          : ''}
                        {' · '}
                        {item.active ? 'Activo' : 'No disponible'}
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
                      <h3>Datos del vehículo</h3>
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
                          <label>Tipo</label>
                          <input
                            value={ficha.tipo}
                            onChange={(e) =>
                              setFicha((p) => (p ? { ...p, tipo: e.target.value } : p))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Capacidad</label>
                          <input
                            type="number"
                            min={1}
                            value={ficha.capacidad}
                            onChange={(e) =>
                              setFicha((p) => (p ? { ...p, capacidad: e.target.value } : p))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Año del vehículo</label>
                          <input
                            type="number"
                            min={1980}
                            max={new Date().getFullYear() + 1}
                            value={ficha.anio}
                            onChange={(e) =>
                              setFicha((p) => (p ? { ...p, anio: e.target.value } : p))
                            }
                            placeholder="Ej: 2018"
                          />
                        </div>
                        <div className="form-group">
                          <label>Patente</label>
                          <input
                            value={ficha.patente}
                            onChange={(e) =>
                              setFicha((p) => (p ? { ...p, patente: e.target.value } : p))
                            }
                            placeholder="Ej: AB123CD"
                          />
                        </div>
                        <div className="form-group">
                          <label>Service pendiente</label>
                          <input
                            value={ficha.servicePendiente}
                            onChange={(e) =>
                              setFicha((p) =>
                                p ? { ...p, servicePendiente: e.target.value } : p,
                              )
                            }
                            placeholder="Ej: Cambio de aceite"
                          />
                        </div>
                        <div className="form-group">
                          <label>Fecha service (opcional)</label>
                          <input
                            type="date"
                            value={ficha.serviceFecha}
                            onChange={(e) =>
                              setFicha((p) => (p ? { ...p, serviceFecha: e.target.value } : p))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>VTV — vencimiento</label>
                          <input
                            type="date"
                            value={ficha.vtvVenceAt}
                            onChange={(e) =>
                              setFicha((p) => (p ? { ...p, vtvVenceAt: e.target.value } : p))
                            }
                          />
                          <small className="transporte-ficha__hint">
                            Estado:{' '}
                            {labelEstadoVtv(
                              ficha.vtvVenceAt
                                ? ficha.vtvVenceAt >= new Date().toISOString().slice(0, 10)
                                  ? 'vigente'
                                  : 'vencida'
                                : 'sin_dato',
                            )}
                          </small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={savingId === item.id}
                        onClick={() => void saveFicha(item.id)}
                      >
                        {savingId === item.id ? 'Guardando...' : 'Guardar ficha'}
                      </button>

                      <h3 className="transporte-ficha__hist-title">Historial de novedades</h3>
                      {!item.novedades?.length ? (
                        <p className="panel-card__desc">Sin novedades todavía.</p>
                      ) : (
                        <ul className="transporte-ficha__novedades">
                          {item.novedades.map((n) => (
                            <li key={n.id}>
                              <div className="transporte-ficha__nov-meta">
                                <strong>{labelEstadoNovedad(n.estado)}</strong>
                                <span>
                                  {n.reportadoPor.username} ·{' '}
                                  {new Date(n.createdAt).toLocaleString('es-AR')}
                                </span>
                              </div>
                              <p>{n.mensaje}</p>
                              {n.detalleAdmin && (
                                <p className="transporte-ficha__detalle">
                                  Admin: {n.detalleAdmin}
                                </p>
                              )}
                              <div className="admin-actions">
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm"
                                  disabled={n.estado === 'PENDIENTE_REVISION'}
                                  onClick={() =>
                                    void updateNovedad(n.id, {
                                      estado: 'PENDIENTE_REVISION',
                                    })
                                  }
                                >
                                  Pendiente de revisión
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--outline btn--sm"
                                  disabled={n.estado === 'RESUELTO'}
                                  onClick={() =>
                                    void updateNovedad(n.id, { estado: 'RESUELTO' })
                                  }
                                >
                                  Resuelto
                                </button>
                              </div>
                              <div className="transporte-ficha__detalle-form">
                                <textarea
                                  rows={2}
                                  placeholder="Detalle / comentario del Admin"
                                  value={novedadDetalle[n.id] ?? n.detalleAdmin ?? ''}
                                  onChange={(e) =>
                                    setNovedadDetalle((prev) => ({
                                      ...prev,
                                      [n.id]: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn--primary btn--sm"
                                  onClick={() =>
                                    void updateNovedad(n.id, {
                                      detalleAdmin: novedadDetalle[n.id] ?? n.detalleAdmin,
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
