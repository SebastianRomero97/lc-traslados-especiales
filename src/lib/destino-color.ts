/** Paleta amplia y contrastada para destinos (hex). */
export const DESTINO_COLOR_PALETTE = [
  '#dc2626', // rojo
  '#2563eb', // azul
  '#eab308', // amarillo
  '#16a34a', // verde
  '#7c3aed', // violeta
  '#ea580c', // naranja
  '#0891b2', // cian
  '#db2777', // rosa
  '#4f46e5', // índigo
  '#0d9488', // teal
  '#ca8a04', // ámbar
  '#65a30d', // lima
  '#9333ea', // púrpura
  '#e11d48', // rose
  '#0284c7', // sky
  '#b45309', // marrón/ámbar oscuro
  '#15803d', // verde oscuro
  '#1d4ed8', // azul fuerte
  '#c026d3', // fucsia
  '#854d0e', // oliva
  '#0f766e', // teal oscuro
  '#be123c', // crimson
  '#4338ca', // indigo oscuro
  '#a16207', // mostaza
] as const;

function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Elige un color no usado en la zona (paleta + fallbacks HSL). */
export function pickUniqueDestinoColor(usedColors: Iterable<string>): string {
  const used = new Set(
    [...usedColors].map(normalizeColor).filter(Boolean),
  );

  for (const c of DESTINO_COLOR_PALETTE) {
    if (!used.has(normalizeColor(c))) return c;
  }

  for (let h = 0; h < 360; h += 12) {
    const c = hslToHex(h, 72, 40);
    if (!used.has(normalizeColor(c))) return c;
  }

  // Último recurso: casi imposible llegar acá en una zona real.
  let n = 0;
  while (n < 10_000) {
    const c = `#${((Math.random() * 0xffffff) | 0).toString(16).padStart(6, '0')}`;
    if (!used.has(normalizeColor(c))) return c;
    n += 1;
  }
  return '#334155';
}
