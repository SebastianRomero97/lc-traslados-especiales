'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { validatePublicacionContent } from '@/lib/publicacion-content';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import type { Role } from '@/lib/roles';

type Destinatario = Extract<Role, 'ADMINISTRACION' | 'CELADORA' | 'CHOFER'>;

type Publicacion = {
  id: string;
  titulo: string;
  cuerpo: string;
  imagenUrl?: string | null;
  roles: Destinatario[];
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
  createdBy?: { id: string; username: string };
};

const DESTINATARIO_OPTIONS: { id: Destinatario; label: string }[] = [
  { id: 'ADMINISTRACION', label: 'Administración' },
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Publicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    cuerpo: '',
    roles: ['ADMINISTRACION', 'CELADORA', 'CHOFER'] as Destinatario[],
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

  useEffect(() => {
    return () => {
      if (imagenPreview) URL.revokeObjectURL(imagenPreview);
    };
  }, [imagenPreview]);

  const toggleRole = (role: Destinatario) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const clearImagen = () => {
    if (imagenPreview) URL.revokeObjectURL(imagenPreview);
    setImagenFile(null);
    setImagenPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onImagenChange = (file: File | null) => {
    if (imagenPreview) URL.revokeObjectURL(imagenPreview);
    if (!file) {
      setImagenFile(null);
      setImagenPreview(null);
      return;
    }
    setImagenFile(file);
    setImagenPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setForm({
      titulo: '',
      cuerpo: '',
      roles: ['ADMINISTRACION', 'CELADORA', 'CHOFER'],
      startsAt: toLocalInput(new Date().toISOString()),
      endsAt: defaultEndsAt(),
    });
    clearImagen();
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (form.roles.length === 0) {
      popup.error('Seleccioná al menos un destinatario.');
      return;
    }
    const content = validatePublicacionContent({
      titulo: form.titulo,
      cuerpo: form.cuerpo,
      hasImagen: Boolean(imagenFile),
    });
    if (!content.ok) {
      popup.error(content.message);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('titulo', content.titulo);
      fd.set('cuerpo', content.cuerpo);
      fd.set('roles', JSON.stringify(form.roles));
      fd.set('startsAt', new Date(form.startsAt).toISOString());
      fd.set('endsAt', new Date(form.endsAt).toISOString());
      if (imagenFile) fd.set('imagen', imagenFile);

      const response = await fetch('/api/admin/publicaciones', {
        method: 'POST',
        body: fd,
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo crear la publicación.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Publicación creada.');
      resetForm();
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
          Combinaciones válidas: solo título, título + mensaje, título + imagen, las tres juntas, o
          solo imagen. El mensaje no puede ir sin título. Destinatarios y vigencia siguen siendo
          obligatorios.
        </p>
        <form className="publicacion-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="pub-titulo">Título (opcional si hay imagen)</label>
            <input
              id="pub-titulo"
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="pub-cuerpo">Mensaje (opcional; requiere título)</label>
            <textarea
              id="pub-cuerpo"
              className="operativo-informe"
              rows={3}
              value={form.cuerpo}
              onChange={(e) => setForm((p) => ({ ...p, cuerpo: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="pub-imagen">Imagen (opcional si hay título)</label>
            <input
              ref={fileInputRef}
              id="pub-imagen"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => onImagenChange(e.target.files?.[0] ?? null)}
            />
            <small className="form-hint">JPG, PNG, WebP o GIF · máx. 5 MB</small>
            {imagenPreview ? (
              <div className="publicacion-imagen-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagenPreview} alt="Vista previa" />
                <button type="button" className="btn btn--outline btn--sm" onClick={clearImagen}>
                  Quitar imagen
                </button>
              </div>
            ) : null}
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
                    <strong>{item.titulo || (item.imagenUrl ? 'Solo imagen' : 'Sin título')}</strong>
                    <span>
                      {vigente ? 'Vigente' : item.active ? 'Fuera de período' : 'Inactiva'} ·{' '}
                      {rolesLabel(item.roles)}
                    </span>
                  </div>
                  {item.imagenUrl ? (
                    <div className="publicaciones-admin-list__img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imagenUrl} alt="" />
                    </div>
                  ) : null}
                  {item.cuerpo ? <p>{item.cuerpo}</p> : null}
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
