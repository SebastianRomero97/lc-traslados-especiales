import { formatAccionFila, formatFechaGrilla, labelTipoItinerario } from '@/lib/grilla.utils';
import { labelTipoCierre } from '@/lib/grilla-estado';
import {
  labelEstadoAsistenciaFicha,
  normalizeEstadoAsistenciaFicha,
} from '@/lib/pasajero.utils';
import { siteConfig } from '@/config/site.config';

export type GrillaPrintInput = {
  nombre: string;
  fecha: string;
  tipoItinerario: string;
  areaNombre: string;
  transporteNombre: string;
  choferNombre: string;
  celadoraNombre: string | null;
  conCeladora: boolean;
  filas: {
    pasajeroNombre: string;
    pasajeroId?: string | null;
  }[];
  asistencias?: {
    pasajeroNombre: string;
    estado: string;
    motivoCancelacion?: string | null;
  }[];
  /** Cierre de jornada (Admin forzado / interrumpido / normal). */
  cierreTipo?: string | null;
  cierreNota?: string | null;
  cerradoPorNombre?: string | null;
  cerradoAt?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nombreKey(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function responsablesDe(g: GrillaPrintInput): string {
  return g.conCeladora
    ? `${g.choferNombre} + ${g.celadoraNombre ?? '—'}`
    : `${g.choferNombre} (sin celadora)`;
}

function pasajerosUnicos(g: GrillaPrintInput): string[] {
  const seenId = new Set<string>();
  const seenNombre = new Set<string>();
  const nombres: string[] = [];
  for (const f of g.filas) {
    const nombre = f.pasajeroNombre.trim();
    if (!nombre) continue;
    if (f.pasajeroId) {
      if (seenId.has(f.pasajeroId)) continue;
      seenId.add(f.pasajeroId);
      seenNombre.add(nombreKey(nombre));
      nombres.push(nombre);
      continue;
    }
    const key = nombreKey(nombre);
    if (seenNombre.has(key)) continue;
    seenNombre.add(key);
    nombres.push(nombre);
  }
  return nombres.sort((a, b) => a.localeCompare(b, 'es'));
}

const PRINT_CSS = `
  body{font-family:Arial,sans-serif;padding:24px;color:#111;line-height:1.35}
  h1{font-size:18px;margin:0 0 12px}
  .recorrido{margin-bottom:18px;page-break-inside:avoid}
  .bar{
    display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem 0.55rem;
    background:#e8e8e8;color:#111;font-size:11px;
    padding:6px 8px;margin:0;
    border:1.5px solid #111;
    border-bottom:none;
  }
  .bar--titulo{font-weight:700;font-size:12px}
  .bar--meta{gap:0.35rem 1.1rem;border-top:none}
  .bar--meta strong{font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:11px;margin:0}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
  th{
    background:#e8e8e8;color:#111;
    border:1.5px solid #111;
    border-top:none;
  }
  table thead tr th:first-child{border-left:1.5px solid #111}
  table thead tr th:last-child{border-right:1.5px solid #111}
  table tbody tr:first-child td{border-top:1.5px solid #111}
  .no-print{margin-top:12px;font-size:12px;color:#444}
  @media print{
    body{padding:0}
    .no-print{display:none}
  }
`;

/** HTML del cuerpo (sin document) para PDF / impresión. */
export function buildGrillaPrintBodyHtml(g: GrillaPrintInput): string {
  const asistMap = new Map<string, { estado: string; observacion: string }>();
  for (const a of g.asistencias ?? []) {
    asistMap.set(nombreKey(a.pasajeroNombre), {
      estado: normalizeEstadoAsistenciaFicha(a.estado),
      observacion: a.motivoCancelacion?.trim() ?? '',
    });
  }

  const filas = pasajerosUnicos(g)
    .map((nombre) => {
      const row = asistMap.get(nombreKey(nombre));
      const estado = row ? labelEstadoAsistenciaFicha(row.estado) : '—';
      const obs = row?.observacion ? row.observacion : '—';
      return `<tr>
        <td>${escapeHtml(nombre)}</td>
        <td>${escapeHtml(estado)}</td>
        <td>${escapeHtml(obs)}</td>
      </tr>`;
    })
    .join('');

  const cierreLabel = labelTipoCierre(g.cierreTipo);
  const cierreBar =
    cierreLabel && (g.cierreTipo === 'FORZADO_ADMIN' || g.cierreTipo === 'INTERRUMPIDO')
      ? `<div class="bar bar--meta">
        <span><strong>Cierre:</strong> ${escapeHtml(cierreLabel)}</span>
        ${
          g.cerradoPorNombre
            ? `<span><strong>Por:</strong> ${escapeHtml(g.cerradoPorNombre)}</span>`
            : ''
        }
        ${
          g.cerradoAt
            ? `<span><strong>Cuando:</strong> ${escapeHtml(
                new Date(g.cerradoAt).toLocaleString('es-AR'),
              )}</span>`
            : ''
        }
        ${
          g.cierreNota
            ? `<span><strong>Observación:</strong> ${escapeHtml(g.cierreNota)}</span>`
            : ''
        }
      </div>`
      : '';

  return `
    <section class="recorrido">
      <div class="bar bar--titulo">
        <span>${escapeHtml(formatFechaGrilla(g.fecha))}</span>
        <span>·</span>
        <span>${escapeHtml(labelTipoItinerario(g.tipoItinerario))}</span>
        <span>·</span>
        <span>${escapeHtml(g.transporteNombre)}</span>
      </div>
      <div class="bar bar--meta">
        <span><strong>Zona:</strong> ${escapeHtml(g.areaNombre)}</span>
        <span><strong>Nombre:</strong> ${escapeHtml(g.nombre || 'Sin nombre')}</span>
        <span><strong>Responsables:</strong> ${escapeHtml(responsablesDe(g))}</span>
      </div>
      ${cierreBar}
      <table>
        <thead>
          <tr>
            <th>Pasajero</th>
            <th>Asistencias</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${filas || '<tr><td colspan="3">Sin pasajeros en este recorrido.</td></tr>'}</tbody>
      </table>
    </section>`;
}

export function buildGrillaPrintDocumentHtml(g: GrillaPrintInput, opts?: { autoPrint?: boolean }): string {
  const title = `${g.nombre || 'Grilla'} · ${formatFechaGrilla(g.fecha)} · ${labelTipoItinerario(g.tipoItinerario)}`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  ${buildGrillaPrintBodyHtml(g)}
  <p class="no-print">Usá Imprimir del navegador y elegí “Guardar como PDF” si querés archivo.</p>
  ${opts?.autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}
</body>
</html>`;
}

export function safePdfFilename(g: GrillaPrintInput): string {
  const base = `${formatFechaGrilla(g.fecha)}_${labelTipoItinerario(g.tipoItinerario)}_${g.nombre || g.transporteNombre}`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `grilla_${base}.pdf`;
}

export function buildGrillaWhatsAppShareText(g: GrillaPrintInput): string {
  return [
    `Grilla: ${g.nombre || 'Sin nombre'}`,
    `${formatFechaGrilla(g.fecha)} · ${labelTipoItinerario(g.tipoItinerario)} · ${g.transporteNombre}`,
    `Zona: ${g.areaNombre}`,
    '',
    'Te mando el PDF del itinerario (adjuntá el archivo descargado).',
  ].join('\n');
}

/** Datos para PDF de itinerario (WhatsApp). */
export type GrillaItinerarioPrintInput = {
  nombre: string;
  fecha: string;
  tipoItinerario: string;
  areaNombre: string;
  transporteNombre: string;
  choferNombre: string;
  celadoraNombre: string | null;
  conCeladora: boolean;
  logoUrl?: string;
  filas: {
    orden: number;
    hora?: string | null;
    direccion: string;
    pasajeroNombre: string;
    accion: string;
    trasbordoHacia?: string | null;
    trasbordoSujeto?: string | null;
    destinoColor?: string | null;
  }[];
};

const ITINERARIO_CSS = `
  body{font-family:Arial,Helvetica,sans-serif;padding:16px;color:#111;line-height:1.3}
  .it-wrap{border:1.5px solid #111}
  .it-title{
    background:#111;color:#fff;font-weight:700;font-size:13px;
    text-align:center;padding:8px 10px;letter-spacing:0.02em;
  }
  .it-head{
    display:flex;align-items:center;gap:10px;
    background:#2e7d32;color:#fff;padding:8px 10px;
    border-top:1.5px solid #111;
  }
  .it-head__logo{width:36px;height:36px;object-fit:contain;background:#fff;border-radius:50%;padding:2px}
  .it-head__zona{flex:1;text-align:center;font-weight:700;font-size:13px;text-transform:uppercase}
  .it-head__fecha{font-weight:700;font-size:12px;white-space:nowrap}
  .it-resp{
    display:flex;flex-wrap:wrap;align-items:stretch;
    border-top:1.5px solid #111;
  }
  .it-resp__left{
    flex:1;min-width:180px;background:#e67e22;color:#111;
    font-weight:700;font-size:11px;padding:7px 10px;
    text-transform:uppercase;
  }
  .it-resp__right{
    min-width:100px;background:#2e7d32;color:#fff;
    font-weight:700;font-size:12px;padding:7px 12px;
    text-align:center;text-transform:uppercase;
    border-left:1.5px solid #111;
  }
  table.itinerario{width:100%;border-collapse:collapse;font-size:11px;margin:0}
  table.itinerario td{
    border:1px solid #333;padding:5px 7px;vertical-align:top;
  }
  table.itinerario td:first-child{
    width:52px;text-align:center;font-weight:700;white-space:nowrap;
  }
  table.itinerario td:last-child{width:38%}
  .it-base{
    background:#111;color:#fff;font-weight:700;font-size:11px;
    text-align:center;padding:7px 10px;text-transform:uppercase;
    border-top:1.5px solid #111;
  }
`;

function logoSrcForPdf(logoUrl?: string): string {
  if (logoUrl?.startsWith('http') || logoUrl?.startsWith('data:')) return logoUrl;
  const path = logoUrl || siteConfig.logoSrc;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
  return path;
}

/** HTML del itinerario operativo (formato planilla, solo WhatsApp PDF). */
export function buildGrillaItinerarioBodyHtml(g: GrillaItinerarioPrintInput): string {
  const tipo = labelTipoItinerario(g.tipoItinerario).toUpperCase();
  const titulo = `ITINERARIO: ${tipo} "${g.transporteNombre.toUpperCase()}"`;
  const responsables = g.conCeladora
    ? `${g.choferNombre} + ${g.celadoraNombre ?? '—'}`.toUpperCase()
    : `${g.choferNombre} (SIN CELADORA)`.toUpperCase();
  const logo = logoSrcForPdf(g.logoUrl);

  const filasHtml = g.filas
    .map((f, index) => {
      const esBase =
        f.accion === 'SALIDA_BASE' ||
        f.accion === 'RETORNO_BASE' ||
        /base/i.test(f.pasajeroNombre) ||
        /base/i.test(f.direccion);
      const marca = f.hora?.trim() || String(f.orden || index + 1);
      const accion = formatAccionFila({
        accion: f.accion,
        pasajeroNombre: f.pasajeroNombre,
        trasbordoHacia: f.trasbordoHacia,
        trasbordoSujeto: f.trasbordoSujeto,
      });
      const color = f.destinoColor?.trim();
      const style =
        color && /^#[0-9A-Fa-f]{3,8}$/.test(color)
          ? `background:${color}22`
          : esBase
            ? 'background:#f3f4f6'
            : '';
      return `<tr style="${style}">
        <td>${escapeHtml(marca)}</td>
        <td>${escapeHtml(f.direccion.toUpperCase())}</td>
        <td>${escapeHtml(accion)}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="it-wrap">
      <div class="it-title">${escapeHtml(titulo)}</div>
      <div class="it-head">
        <img class="it-head__logo" src="${escapeHtml(logo)}" alt="LC" crossorigin="anonymous" />
        <div class="it-head__zona">${escapeHtml(g.areaNombre.toUpperCase())}</div>
        <div class="it-head__fecha">${escapeHtml(formatFechaGrilla(g.fecha))}</div>
      </div>
      <div class="it-resp">
        <div class="it-resp__left">RESPONSABLES: ${escapeHtml(responsables)}</div>
        <div class="it-resp__right">${escapeHtml(g.transporteNombre.toUpperCase())}</div>
      </div>
      <table class="itinerario">
        <tbody>${filasHtml || '<tr><td colspan="3">Sin paradas en este itinerario.</td></tr>'}</tbody>
      </table>
    </div>`;
}

/** Genera y descarga PDF del itinerario (WhatsApp). */
export async function downloadGrillaItinerarioPdf(
  g: GrillaItinerarioPrintInput,
): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '-10000px';
  wrap.style.top = '0';
  wrap.style.width = '800px';
  wrap.style.background = '#fff';
  wrap.style.padding = '12px';
  wrap.innerHTML = `<style>${ITINERARIO_CSS}</style>${buildGrillaItinerarioBodyHtml(g)}`;
  document.body.appendChild(wrap);

  const filename = `itinerario_${safePdfFilename({
    nombre: g.nombre,
    fecha: g.fecha,
    tipoItinerario: g.tipoItinerario,
    areaNombre: g.areaNombre,
    transporteNombre: g.transporteNombre,
    choferNombre: g.choferNombre,
    celadoraNombre: g.celadoraNombre,
    conCeladora: g.conCeladora,
    filas: [],
  }).replace(/^grilla_/, '')}`;

  try {
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(wrap)
      .save();
  } finally {
    wrap.remove();
  }
}

/** Abre ventana de impresión sin noopener (evita que document.write falle). */
export function openGrillaPrintWindow(g: GrillaPrintInput): boolean {
  const html = buildGrillaPrintDocumentHtml(g, { autoPrint: true });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Genera y descarga PDF con el mismo layout de impresión. */
export async function downloadGrillaPdf(g: GrillaPrintInput): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '-10000px';
  wrap.style.top = '0';
  wrap.style.width = '800px';
  wrap.style.background = '#fff';
  wrap.style.padding = '16px';
  wrap.innerHTML = `<style>${PRINT_CSS}</style>${buildGrillaPrintBodyHtml(g)}`;
  document.body.appendChild(wrap);

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: safePdfFilename(g),
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(wrap)
      .save();
  } finally {
    wrap.remove();
  }
}
