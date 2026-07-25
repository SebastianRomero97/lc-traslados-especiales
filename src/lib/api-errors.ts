/** Helpers para mensajes de error claros en APIs y UI */

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Devuelve mensaje tipo: "Falta completar: Transporte, Chofer."
 */
export function missingFieldsMessage(
  values: Record<string, unknown>,
  labels: Record<string, string>,
): string | null {
  const missing = Object.keys(values)
    .filter((key) => isBlank(values[key]))
    .map((key) => labels[key] ?? key);

  if (missing.length === 0) return null;
  if (missing.length === 1) return `Falta completar: ${missing[0]}.`;
  return `Falta completar: ${missing.slice(0, -1).join(', ')} y ${missing.at(-1)}.`;
}

export function apiError(message: string, status = 400) {
  return Response.json({ message }, { status });
}

/** Extrae mensaje útil de errores de Prisma / genéricos */
export function describeCaughtError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const err = error as {
    code?: string;
    message?: string;
    meta?: { target?: string[] | string; field_name?: string };
  };

  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target)
      ? err.meta?.target.join(', ')
      : err.meta?.target;
    return target
      ? `Ya existe un registro con el mismo valor (${target}).`
      : 'Ya existe un registro con esos datos.';
  }

  if (err.code === 'P2003') {
    return 'Hay una referencia inválida (revisá área, transporte, chofer, celadora o pasajero).';
  }

  if (err.code === 'P2025') {
    return 'No se encontró el registro indicado.';
  }

  if (typeof err.message === 'string' && err.message.trim()) {
    // Evitar dumps enormes; acortar
    const short = err.message.split('\n')[0].slice(0, 220);
    return `${fallback} Detalle: ${short}`;
  }

  return fallback;
}

/** Para el frontend: prioriza message del JSON de la API */
export async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message?.trim()) return body.message;
  } catch {
    // ignore
  }
  if (response.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.';
  if (response.status === 403) return 'No tenés permiso para esta acción.';
  if (response.status >= 500) return fallback;
  return fallback;
}
