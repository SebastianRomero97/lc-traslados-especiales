export type Role = 'ADMIN' | 'ADMINISTRACION' | 'CELADORA' | 'CHOFER';

export const ASSIGNABLE_ROLES: Role[] = ['ADMINISTRACION', 'CELADORA', 'CHOFER'];

export const ROLE_PANEL_PATH: Record<Role, string> = {
  ADMIN: '/panel/admin',
  ADMINISTRACION: '/panel/administracion',
  CELADORA: '/panel/celadora',
  CHOFER: '/panel/chofer',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  ADMINISTRACION: 'Administración',
  CELADORA: 'Celadora',
  CHOFER: 'Chofer',
};

/** Prioridad de panel por defecto tras login */
const DEFAULT_PANEL_ORDER: Role[] = ['ADMIN', 'ADMINISTRACION', 'CELADORA', 'CHOFER'];

export type SessionUser = {
  id: string;
  username: string;
  roles: Role[];
  /** Chofer con vehículo propio: no rinde combustible. */
  isPrestador?: boolean;
  /** Administración: puede aprobar/observar grillas (sin ser Admin). */
  puedeAprobar?: boolean;
};

/** Admin siempre; Administración solo con flag `puedeAprobar`. */
export function canApproveGrillas(user: SessionUser): boolean {
  if (hasRole(user, 'ADMIN')) return true;
  return hasRole(user, 'ADMINISTRACION') && Boolean(user.puedeAprobar);
}

export function hasRole(user: { roles: Role[] }, role: Role): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: { roles: Role[] }, roles: Role[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function formatRoles(roles: Role[]): string {
  return roles.map((role) => ROLE_LABEL[role]).join(' · ');
}

export function panelPathsFor(user: { roles: Role[] }): { role: Role; path: string; label: string }[] {
  return DEFAULT_PANEL_ORDER.filter((role) => user.roles.includes(role)).map((role) => ({
    role,
    path: ROLE_PANEL_PATH[role],
    label: ROLE_LABEL[role],
  }));
}

/** Paneles a los que el usuario puede navegar (Admin también puede ir a Administración). */
export function accessiblePanelsFor(user: {
  roles: Role[];
}): { role: Role; path: string; label: string }[] {
  const panels = panelPathsFor(user);
  if (hasRole(user, 'ADMIN') && !panels.some((p) => p.role === 'ADMINISTRACION')) {
    panels.push({
      role: 'ADMINISTRACION',
      path: ROLE_PANEL_PATH.ADMINISTRACION,
      label: ROLE_LABEL.ADMINISTRACION,
    });
  }
  return panels;
}

export function defaultPanelPath(user: { roles: Role[] }): string {
  const panels = panelPathsFor(user);
  return panels[0]?.path ?? '/login';
}

export function isValidAssignableRoles(roles: unknown): roles is Role[] {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  if (roles.includes('ADMIN')) return false;
  const unique = new Set(roles);
  if (unique.size !== roles.length) return false;
  return roles.every((role) => ASSIGNABLE_ROLES.includes(role as Role));
}

/**
 * Orden visual del listado Admin:
 * Admin → Administración (solo) → roles múltiples → Celadora → Chofer
 */
export function userListGroupRank(roles: Role[]): number {
  if (roles.includes('ADMIN')) return 0;
  if (roles.length > 1) return 2;
  if (roles.includes('ADMINISTRACION')) return 1;
  if (roles.includes('CELADORA')) return 3;
  if (roles.includes('CHOFER')) return 4;
  return 5;
}

export function compareUsersForAdminList(
  a: { username: string; roles: Role[] },
  b: { username: string; roles: Role[] },
): number {
  const rankDiff = userListGroupRank(a.roles) - userListGroupRank(b.roles);
  if (rankDiff !== 0) return rankDiff;
  return a.username.localeCompare(b.username, 'es', { sensitivity: 'base' });
}
