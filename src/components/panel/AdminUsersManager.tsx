'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import {
  ASSIGNABLE_ROLES,
  compareUsersForAdminList,
  ROLE_LABEL,
  type Role,
} from '@/lib/roles';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type AdminUser = {
  id: string;
  username: string;
  roles: Role[];
  active: boolean;
  createdAt: string;
};

type EditForm = {
  username: string;
  active: boolean;
  roles: Role[];
};

export function AdminUsersManager({ currentUserId }: { currentUserId: string }) {
  const popup = usePanelPopup();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    roles: ['CELADORA'] as Role[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    username: '',
    active: true,
    roles: [],
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar los usuarios.');
        return;
      }
      setUsers(body.data as AdminUser[]);
    } catch {
      popup.error(
        'Error de conexión al cargar usuarios. Revisá que el servidor esté en marcha.',
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(() => [...users].sort(compareUsersForAdminList), [users]);

  const toggleRole = (role: Role) => {
    setForm((prev) => {
      const has = prev.roles.includes(role);
      const roles = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  const toggleEditRole = (role: Role) => {
    setEditForm((prev) => {
      const has = prev.roles.includes(role);
      const roles = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  const startEdit = (user: AdminUser) => {
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      active: user.active,
      roles: [...user.roles],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ username: '', active: true, roles: [] });
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    const missing = missingFieldsMessage(
      {
        username: form.username,
        password: form.password,
        roles: form.roles.length > 0 ? 'ok' : '',
      },
      { username: 'usuario', password: 'contraseña', roles: 'al menos un rol' },
    );
    if (missing) {
      popup.error(missing);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          roles: form.roles,
        }),
      });

      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo crear el usuario.'));
        return;
      }

      const body = (await response.json()) as { message?: string };
      setForm({ username: '', password: '', roles: ['CELADORA'] });
      popup.success(body.message ?? 'Usuario creado.');
      await loadUsers();
    } catch {
      popup.error(
        'Error de conexión al crear el usuario. Revisá que el servidor esté en marcha.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (user: AdminUser) => {
    const isAdmin = user.roles.includes('ADMIN');

    if (!editForm.username.trim() || editForm.username.trim().length < 2) {
      popup.error('El usuario debe tener al menos 2 caracteres.');
      return;
    }

    if (!isAdmin && editForm.roles.length === 0) {
      popup.error('Seleccioná al menos un rol.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: { username: string; active: boolean; roles?: Role[] } = {
        username: editForm.username.trim(),
        active: editForm.active,
      };
      if (!isAdmin) {
        payload.roles = editForm.roles;
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo actualizar el usuario.'));
        return;
      }

      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Usuario actualizado.');
      cancelEdit();
      await loadUsers();
    } catch {
      popup.error('Error de conexión al actualizar. Revisá que el servidor esté en marcha.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (user.id === currentUserId) return;
    const confirmed = await popup.confirm({
      message: `¿Eliminar al usuario "${user.username}"?`,
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });

      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo eliminar el usuario.'));
        return;
      }

      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Usuario eliminado.');
      if (editingId === user.id) cancelEdit();
      await loadUsers();
    } catch {
      popup.error('Error de conexión al eliminar. Revisá que el servidor esté en marcha.');
    }
  };

  return (
    <div className="admin-users">
      {popup.popupNode}
      <section className="admin-users__create panel-card">
        <h2>Crear usuario</h2>
        <p className="panel-card__desc">
          Solo el Admin puede dar de alta usuarios. Podés asignar uno o más roles (excepto Admin).
        </p>

        <form className="admin-users__form" onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="Nombre de usuario"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Contraseña"
              required
              minLength={4}
            />
          </div>

          <fieldset className="form-group admin-users__roles">
            <legend>Roles</legend>
            <p className="panel-card__desc" style={{ marginTop: 0 }}>
              Marcá todos los que correspondan. Ejemplo: Celadora + Administración.
            </p>
            <div className="admin-users__role-checks">
              {ASSIGNABLE_ROLES.map((role) => (
                <label key={role} className="admin-users__role-check">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {ROLE_LABEL[role]}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || form.roles.length === 0}
          >
            {submitting ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </section>

      <section className="admin-users__list panel-card">
        <h2>Usuarios</h2>
        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : users.length === 0 ? (
          <p className="panel-card__desc">No hay usuarios cargados.</p>
        ) : (
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Roles</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const isAdmin = user.roles.includes('ADMIN');
                  const canDelete = user.id !== currentUserId && !isAdmin;
                  const isEditing = editingId === user.id;

                  return (
                    <tr key={user.id} className={isEditing ? 'is-selected' : undefined}>
                      <td>
                        {isEditing ? (
                          <input
                            value={editForm.username}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, username: e.target.value }))
                            }
                            aria-label="Usuario"
                          />
                        ) : (
                          user.username
                        )}
                      </td>
                      <td>
                        {isEditing && !isAdmin ? (
                          <div className="admin-users__role-checks">
                            {ASSIGNABLE_ROLES.map((role) => (
                              <label key={role} className="admin-users__role-check">
                                <input
                                  type="checkbox"
                                  checked={editForm.roles.includes(role)}
                                  onChange={() => toggleEditRole(role)}
                                />
                                {ROLE_LABEL[role]}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="admin-users__role-list">
                            {user.roles.map((role) => (
                              <span
                                key={role}
                                className={`role-badge role-badge--${role.toLowerCase()}`}
                              >
                                {ROLE_LABEL[role]}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            value={editForm.active ? 'activo' : 'no'}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                active: e.target.value === 'activo',
                              }))
                            }
                            aria-label="Estado"
                            disabled={user.id === currentUserId}
                          >
                            <option value="activo">Activo</option>
                            <option value="no">No disponible</option>
                          </select>
                        ) : user.active ? (
                          'Activo'
                        ) : (
                          'No disponible'
                        )}
                      </td>
                      <td className="admin-actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled={submitting}
                              onClick={() => void handleSaveEdit(user)}
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
                              onClick={() => startEdit(user)}
                            >
                              Editar
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() => void handleDelete(user)}
                              >
                                Eliminar
                              </button>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
