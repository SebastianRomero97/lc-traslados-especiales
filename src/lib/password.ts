/** Longitud mínima de contraseña (crear / reset). */
export const PASSWORD_MIN_LENGTH = 8;

export function validatePasswordPlain(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}
