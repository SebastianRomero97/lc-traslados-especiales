'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import type { Role } from '@/lib/roles';

type Destinatario = Extract<Role, 'COORDINADORA' | 'CELADORA' | 'CHOFER'>;

type Publicacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  roles: Destinatario[];
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
  createdBy?: { id: string; username: string };
};

const DESTINATARIO_OPTIONS: { id: Destinatario; label: string }[] = [
  { id: 'COORDINADORA', label: 'Administración' },
  { id: 'CELADORA', label: 'Celadoras' },
  { id: 'CHOFER', label: 'Choferes' },
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultEndsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalInput(d.toISOString());
}

function rolesLabel(roles: Destinatario[]): string {
  if (!roles?.length) return 'Sin destinatarios';
  return DESTINATARIO_OPTIONS.filter((o) => roles.includes(o.id))
    .map((o) => o.label)
    .join(', ');
}

export function AdminPublicacionesManager() {
  const popup = usePanelPopup();
  const [items, setItems] = useState<Publicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    cuerpo: '',
    roles: ['COORDINADORA', 'CELADORA', 'CHOFER'] as Destinatario[],
    startsAt: toLocalInput(new Date().toISOString()),
    endsAt: defaultEndsAt(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/publicaciones');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar las publicaciones.');
        return;
      }
      setItems(body.data as Publicacion[]);
    } catch {
      popup.error('Error de conexión al cargar publicaciones.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRole = (role: Destinatario) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (form.roles.length === 0) {
      popup.error('Seleccioná al menos un destinatario.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/publicaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo crear la publicación.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Publicación creada.');
      setForm({
        titulo: '',
        cuerpo: '',
        roles: ['COORDINADORA', 'CELADORA', 'CHOFER'],
        startsAt: toLocalInput(new Date().toISOString()),
        endsAt: defaultEndsAt(),
      });
      await load();
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item: Publicacion) => {
    const response = await fetch(`/api/admin/publicaciones/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo actualizar.'));
      return;
    }
    popup.success(item.active ? 'Publicación desactivada.' : 'Publicación activada.');
    await load();
  };

  const remove = async (id: string) => {
    const ok = await popup.confirm({
      message: '¿Eliminar esta publicación?',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/publicaciones/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar.'));
      return;
    }
    popup.success('Publicación eliminada.');
    await load();
  };

  return (
    <div className="admin-section">
      {popup.popupNode}

      <section className="panel-card">
        <h2>Nueva publicación</h2>
        <p className="panel-card__desc">
          Elegí manualmente a quiénes llega el aviso. Mientras esté activa y dentro del período,
          aparece en el panel de esos roles.
        </p>
        <form className="publicacion-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="pub-titulo">Título</label>
            <input
              id="pub-titulo"
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              required
              minLength={3}
            />
          </div>
          <div className="form-group">
            <label htmlFor="pub-cuerpo">Mensaje</label>
            <textarea
              id="pub-cuerpo"
              className="operativo-informe"
              rows={3}
              value={form.cuerpo}
              onChange={(e) => setForm((p) => ({ ...p, cuerpo: e.target.value }))}
              required
              minLength={5}
            />
          </div>
          <fieldset className="publicacion-destinatarios">
            <legend>Destinatarios</legend>
            <div className="publicacion-destinatarios__options">
              {DESTINATARIO_OPTIONS.map((opt) => (
                <label key={opt.id} className="publicacion-destinatarios__option">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(opt.id)}
                    onChange={() => toggleRole(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="publicacion-form__grid">
            <div className="form-group">
              <label htmlFor="pub-start">Desde</label>
              <input
                id="pub-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="pub-end">Hasta</label>
              <input
                id="pub-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || form.roles.length === 0}
          >
            {submitting ? 'Publicando...' : 'Publicar'}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2>Publicaciones</h2>
        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="panel-card__desc">Todavía no hay publicaciones.</p>
        ) : (
          <ul className="publicaciones-admin-list">
            {items.map((item) => {
              const vigente =
                item.active &&
                new Date(item.startsAt) <= new Date() &&
                new Date(item.endsAt) >= new Date();
              return (
                <li key={item.id} className={!item.active ? 'is-inactive' : ''}>
                  <div className="publicaciones-admin-list__head">
                    <strong>{item.titulo}</strong>
                    <span>
                      {vigente ? 'Vigente' : item.active ? 'Fuera de período' : 'Inactiva'} ·{' '}
                      {rolesLabel(item.roles)}
                    </span>
                  </div>
                  <p>{item.cuerpo}</p>
                  <small>
                    {new Date(item.startsAt).toLocaleString('es-AR')} →{' '}
                    {new Date(item.endsAt).toLocaleString('es-AR')}
                    {item.createdBy ? ` · ${item.createdBy.username}` : ''}
                  </small>
                  <div className="admin-actions">
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
                      onClick={() => void remove(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
