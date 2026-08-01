/**
 * Contenido de publicación:
 * - solo título
 * - título + mensaje
 * - título + imagen
 * - título + mensaje + imagen
 * - solo imagen
 * El mensaje nunca puede ir sin título.
 */

export type PublicacionContentInput = {
  titulo: string;
  cuerpo: string;
  hasImagen: boolean;
};

export function normalizePublicacionText(titulo: string, cuerpo: string) {
  return {
    titulo: titulo.trim(),
    cuerpo: cuerpo.trim(),
  };
}

/** Valida y normaliza. Devuelve error o el payload listo para guardar. */
export function validatePublicacionContent(
  input: PublicacionContentInput,
): { ok: true; titulo: string; cuerpo: string } | { ok: false; message: string } {
  const titulo = input.titulo.trim();
  const cuerpo = input.cuerpo.trim();
  const hasTitulo = titulo.length > 0;
  const hasMensaje = cuerpo.length > 0;
  const hasImagen = input.hasImagen;

  if (hasMensaje && !hasTitulo) {
    return {
      ok: false,
      message: 'El mensaje necesita un título. Podés publicar solo título, solo imagen, o combinarlos.',
    };
  }

  if (!hasTitulo && !hasImagen) {
    return {
      ok: false,
      message: 'Indicá un título o una imagen (o ambos).',
    };
  }

  if (hasTitulo && titulo.length < 2) {
    return { ok: false, message: 'El título debe tener al menos 2 caracteres.' };
  }

  if (hasMensaje && cuerpo.length < 2) {
    return { ok: false, message: 'El mensaje debe tener al menos 2 caracteres.' };
  }

  return { ok: true, titulo, cuerpo };
}
