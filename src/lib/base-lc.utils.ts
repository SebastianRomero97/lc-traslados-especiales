/** Destino canónico de la empresa (único para todas las áreas). */
export const BASE_LC_NOMBRE = 'Base LC';

export function isBaseLcNombre(nombre: string): boolean {
  return /^base\s*lc$/i.test(nombre.trim());
}
