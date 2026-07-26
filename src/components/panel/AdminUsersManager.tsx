'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import {
  ASSIGNABLE_ROLES,
  compareUsersForAdminList,
  ROLE_LABEL,
  type Role,
} from '@/lib/roles';

type AdminUser = {
  id: string;
  username: string;
  roles: Role[];
  active: boolean;
  createdAt: string;
};

export function AdminUsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [form, setForm] = useState({
    username: '',
    password: '',
    roles: ['CELADORA'] as Role[],
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      const body = await response.json();
      if (!response.ok) {
        setFeedback({ type: 'error', message: body.message ?? 'No se pudieron cargar los usuarios.' });
        return;
      }
      setUsers(body.data as AdminUser[]);
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexión al cargar usuarios. Revisá que el servidor esté en marcha.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(
    () => [...users].sort(compareUsersForAdminList),
    [users],
  );

  const toggleRole = (role: Role) => {
    setForm((prev) => {
      const has = prev.roles.includes(role);
      const roles = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const missing = missingFieldsMessage(
      {
        username: form.username,
        password: form.password,
        roles: form.roles.length > 0 ? 'ok' : '',
      },
      { username: 'usuario', password: 'contraseña', roles: 'al menos un rol' },
    );
    if (missing) {
      setFeedback({ type: 'error', message: missing });
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
        setFeedback({
          type: 'error',
          message: await readApiError(response, 'No se pudo crear el usuario.'),
        });
        return;
      }

      const body = (await response.json()) as { message?: string };
      setForm({ username: '', password: '', roles: ['CELADORA'] });
      setFeedback({ type: 'success', message: body.message ?? 'Usuario creado.' });
      await loadUsers();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Error de conexión al crear el usuario. Revisá que el servidor esté en marcha.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (user.id === currentUserId) return;
    const confirmed = window.confirm(`¿Eliminar al usuario "${user.username}"?`);
    if (!confirmed) return;

    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });

      if (!response.ok) {
        setFeedback({
          type: 'error',
          message: await readApiError(response, 'No se pudo eliminar el usuario.'),
        });
        return;
      }

      const body = (await response.json()) as { message?: string };
      setFeedback({ type: 'success', message: body.message ?? 'Usuario eliminado.' });
      await loadUsers();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Error de conexión al eliminar. Revisá que el servidor esté en marcha.',
      });
    }
  };

  return (
    <div className="admin-users">
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
              Marcá todos los que correspondan. Ejemplo: Celadora + Coordinadora.
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

        {feedback && (
          <p className={`form-feedback form-feedback--${feedback.type}`} role="status">
            {feedback.message}
          </p>
        )}
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
                  return (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>
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
                      </td>
                      <td>{user.active ? 'Activo' : 'Inactivo'}</td>
                      <td>
                        {canDelete ? (
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => void handleDelete(user)}
                          >
                            Eliminar
                          </button>
                        ) : (
                          <span className="admin-users__muted">—</span>
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
