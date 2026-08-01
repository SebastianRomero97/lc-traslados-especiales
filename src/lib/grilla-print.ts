import { formatFechaGrilla, labelTipoItinerario } from '@/lib/grilla.utils';
import {
  labelEstadoAsistenciaFicha,
  normalizeEstadoAsistenciaFicha,
} from '@/lib/pasajero.utils';

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
  const seen = new Set<string>();
  const nombres: string[] = [];
  for (const f of g.filas) {
    if (!f.pasajeroId) continue;
    if (seen.has(f.pasajeroId)) continue;
    seen.add(f.pasajeroId);
    const nombre = f.pasajeroNombre.trim();
    if (!nombre) continue;
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
        <span><strong>Área:</strong> ${escapeHtml(g.areaNombre)}</span>
        <span><strong>Nombre:</strong> ${escapeHtml(g.nombre || 'Sin nombre')}</span>
        <span><strong>Responsables:</strong> ${escapeHtml(responsablesDe(g))}</span>
      </div>
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
    `Área: ${g.areaNombre}`,
    '',
    'Te mando el PDF de la grilla (adjuntá el archivo descargado).',
  ].join('\n');
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
