import { formatAccionFila, formatFechaGrilla, labelTipoItinerario } from '@/lib/grilla.utils';

export type RespaldoGrilla = {
  id: string;
  fecha: string;
  tipoItinerario: string;
  area: string;
  transporte: string;
  tipoTransporte: string;
  chofer: string;
  celadora: string | null;
  conCeladora: boolean;
  nota: string | null;
  choferMinutos: number | null;
  celadoraMinutos: number | null;
  informeChofer: string | null;
  informeCeladora: string | null;
  informeChoferCeladora: string | null;
  informeChoferVehiculo: string | null;
  combustibleNivel: string | null;
  asistio: number;
  cancelo: number;
  noSePresento: number;
  filas: {
    hora: string | null;
    direccion: string;
    pasajeroNombre: string;
    accion: string;
    trasbordoHacia: string | null;
  }[];
  asistencias: {
    pasajeroNombre: string;
    estado: string;
    motivoCancelacion: string | null;
  }[];
};

export function durationMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

export function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildGrillasCsv(grillas: RespaldoGrilla[]): string {
  const header = [
    'Fecha',
    'Itinerario',
    'Area',
    'Transporte',
    'Tipo',
    'Chofer',
    'Celadora',
    'Duracion chofer (min)',
    'Duracion celadora (min)',
    'Asistio',
    'Cancelo',
    'No se presento',
    'Combustible',
    'Informe chofer',
    'Informe celadora',
    'Nota',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const g of grillas) {
    lines.push(
      [
        formatFechaGrilla(g.fecha),
        labelTipoItinerario(g.tipoItinerario),
        g.area,
        g.transporte,
        g.tipoTransporte,
        g.chofer,
        g.conCeladora ? (g.celadora ?? '') : 'Sin celadora',
        g.choferMinutos ?? '',
        g.celadoraMinutos ?? '',
        g.asistio,
        g.cancelo,
        g.noSePresento,
        g.combustibleNivel ?? '',
        g.informeChofer ?? '',
        g.informeCeladora ?? '',
        g.nota ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function buildAsistenciasCsv(grillas: RespaldoGrilla[]): string {
  const header = [
    'Fecha',
    'Itinerario',
    'Area',
    'Transporte',
    'Pasajero',
    'Estado',
    'Motivo',
    'Chofer',
    'Celadora',
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const g of grillas) {
    for (const a of g.asistencias) {
      lines.push(
        [
          formatFechaGrilla(g.fecha),
          labelTipoItinerario(g.tipoItinerario),
          g.area,
          g.transporte,
          a.pasajeroNombre,
          a.estado,
          a.motivoCancelacion ?? '',
          g.chofer,
          g.conCeladora ? (g.celadora ?? '') : 'Sin celadora',
        ]
          .map(csvEscape)
          .join(','),
      );
    }
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function buildRespaldoPrintHtml(params: {
  titulo: string;
  desde: string;
  hasta: string;
  filtrosResumen: string;
  grillas: RespaldoGrilla[];
}): string {
  const bloques = params.grillas
    .map((g) => {
      const responsables = g.conCeladora
        ? `${g.chofer} + ${g.celadora ?? '—'}`
        : `${g.chofer} (sin celadora)`;
      const filas = g.filas
        .map(
          (f) =>
            `<tr><td>${escapeHtml(f.hora ?? '—')}</td><td>${escapeHtml(f.direccion)}</td><td>${escapeHtml(
              formatAccionFila({
                accion: f.accion,
                pasajeroNombre: f.pasajeroNombre,
                trasbordoHacia: f.trasbordoHacia,
              }),
            )}</td></tr>`,
        )
        .join('');
      const asistencias = g.asistencias
        .map(
          (a) =>
            `<tr><td>${escapeHtml(a.pasajeroNombre)}</td><td>${escapeHtml(a.estado)}</td><td>${escapeHtml(
              a.motivoCancelacion ?? '',
            )}</td></tr>`,
        )
        .join('');

      return `
        <section class="grilla">
          <h2>${escapeHtml(formatFechaGrilla(g.fecha))} · ${
            labelTipoItinerario(g.tipoItinerario)
          } · ${escapeHtml(g.transporte)}</h2>
          <div class="meta">
            <div><strong>Área:</strong> ${escapeHtml(g.area)}</div>
            <div><strong>Tipo:</strong> ${escapeHtml(g.tipoTransporte)}</div>
            <div><strong>Responsables:</strong> ${escapeHtml(responsables)}</div>
            <div><strong>Tiempos:</strong> chofer ${g.choferMinutos ?? '—'} min · celadora ${
              g.celadoraMinutos ?? '—'
            } min</div>
            <div><strong>Asistencias:</strong> ${g.asistio} · Canceló ${g.cancelo} · No se presentó ${
              g.noSePresento
            }</div>
            ${g.combustibleNivel ? `<div><strong>Combustible:</strong> ${escapeHtml(g.combustibleNivel)}</div>` : ''}
            ${g.nota ? `<div><strong>Nota:</strong> ${escapeHtml(g.nota)}</div>` : ''}
            ${g.informeCeladora ? `<div><strong>Informe celadora:</strong> ${escapeHtml(g.informeCeladora)}</div>` : ''}
            ${g.informeChofer ? `<div><strong>Informe chofer:</strong> ${escapeHtml(g.informeChofer)}</div>` : ''}
          </div>
          <h3>Itinerario</h3>
          <table>
            <thead><tr><th>Hora</th><th>Parada / dirección</th><th>Acción</th></tr></thead>
            <tbody>${filas || '<tr><td colspan="3">Sin filas</td></tr>'}</tbody>
          </table>
          <h3>Asistencias</h3>
          <table>
            <thead><tr><th>Pasajero</th><th>Estado</th><th>Motivo</th></tr></thead>
            <tbody>${asistencias || '<tr><td colspan="3">Sin registros</td></tr>'}</tbody>
          </table>
        </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.titulo)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111;line-height:1.4}
    h1{font-size:20px;margin:0 0 8px}
    h2{font-size:16px;margin:0 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
    h3{font-size:14px;margin:14px 0 6px}
    .resumen{margin-bottom:20px;font-size:13px;color:#333}
    .grilla{margin-bottom:28px;page-break-inside:avoid}
    .meta{font-size:12px;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
    th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}
    th{background:#111;color:#fff}
    @media print{
      body{padding:0}
      .no-print{display:none}
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(params.titulo)}</h1>
  <div class="resumen">
    <div><strong>Período:</strong> ${escapeHtml(params.desde)} → ${escapeHtml(params.hasta)}</div>
    <div><strong>Filtros:</strong> ${escapeHtml(params.filtrosResumen)}</div>
    <div><strong>Grillas:</strong> ${params.grillas.length}</div>
    <p class="no-print">Usá Imprimir del navegador y elegí “Guardar como PDF” si querés archivo.</p>
  </div>
  ${bloques || '<p>No hay grillas para exportar con estos filtros.</p>'}
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
