export type Role = 'ADMIN' | 'COORDINADORA' | 'CELADORA' | 'CHOFER';

export const ROLE_PANEL_PATH: Record<Role, string> = {
  ADMIN: '/panel/admin',
  COORDINADORA: '/panel/coordinadora',
  CELADORA: '/panel/celadora',
  CHOFER: '/panel/chofer',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  COORDINADORA: 'Coordinadora',
  CELADORA: 'Celadora',
  CHOFER: 'Chofer',
};

export type SessionUser = {
  id: string;
  username: string;
  role: Role;
};
