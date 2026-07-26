/**
 * Saludo según el nombre conocido.
 * Por defecto femenino (mayoría del equipo operativo); excepciones masculinas explícitas.
 */
const MASCULINE_USERNAMES = new Set([
  'hori',
  'seba',
  'facundo',
]);

export function welcomeHeading(username: string): string {
  const key = username.trim().toLowerCase();
  if (MASCULINE_USERNAMES.has(key)) {
    return `Bienvenido, ${username}`;
  }
  return `Bienvenida, ${username}`;
}
