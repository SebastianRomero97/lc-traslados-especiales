import {
  formatFechaGrilla,
  fechaGrillaKey,
  labelTipoItinerario,
  modalidadItinerario,
  sentidoItinerario,
  type ModalidadItinerario,
} from '@/lib/grilla.utils';
import {
  labelEstadoAsistenciaFicha,
  normalizeEstadoAsistenciaFicha,
} from '@/lib/pasajero.utils';

export type RespaldoGrilla = {
  id: string;
  nombre: string;
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
    pasajeroId: string | null;
    accion: string;
    trasbordoHacia: string | null;
  }[];
  asistencias: {
    pasajeroNombre: string;
    estado: string;
    motivoCancelacion: string | null;
  }[];
};

/** Jornada unificada: misma fecha + área + nombre + modalidad (ingreso/salida). */
export type RespaldoJornada = {
  fechaKey: string;
  fecha: string;
  area: string;
  nombre: string;
  modalidad: ModalidadItinerario;
  ingreso: RespaldoGrilla | null;
  salida: RespaldoGrilla | null;
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

function nombreKey(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function scoreGrilla(g: RespaldoGrilla): number {
  return g.filas.length + g.asistencias.length;
}

function jornadaGroupKey(g: RespaldoGrilla): string {
  return [
    fechaGrillaKey(g.fecha),
    g.area.trim().toLowerCase(),
    g.nombre.trim().toLowerCase(),
    modalidadItinerario(g.tipoItinerario),
  ].join('|');
}

/** Agrupa grillas sueltas en jornadas (fecha + área + nombre + modalidad). */
export function agruparRespaldoJornadas(grillas: RespaldoGrilla[]): RespaldoJornada[] {
  const map = new Map<string, RespaldoJornada>();

  for (const g of grillas) {
    const key = jornadaGroupKey(g);
    const sentido = sentidoItinerario(g.tipoItinerario);
    let jornada = map.get(key);
    if (!jornada) {
      jornada = {
        fechaKey: fechaGrillaKey(g.fecha),
        fecha: g.fecha,
        area: g.area,
        nombre: g.nombre,
        modalidad: modalidadItinerario(g.tipoItinerario),
        ingreso: null,
        salida: null,
      };
      map.set(key, jornada);
    }

    if (sentido === 'INGRESO') {
      if (!jornada.ingreso || scoreGrilla(g) >= scoreGrilla(jornada.ingreso)) {
        jornada.ingreso = g;
      }
    } else if (!jornada.salida || scoreGrilla(g) >= scoreGrilla(jornada.salida)) {
      jornada.salida = g;
    }
  }

  return [...map.values()].sort((a, b) => {
    const byFecha = b.fechaKey.localeCompare(a.fechaKey);
    if (byFecha !== 0) return byFecha;
    const byArea = a.area.localeCompare(b.area, 'es');
    if (byArea !== 0) return byArea;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function labelModalidadTitulo(modalidad: ModalidadItinerario): string {
  if (modalidad === 'ADAPTACION') return 'Adaptación';
  if (modalidad === 'ESPECIAL') return 'Especial';
  return 'Normal';
}

function responsablesDe(g: RespaldoGrilla): string {
  return g.conCeladora
    ? `${g.chofer} + ${g.celadora ?? '—'}`
    : `${g.chofer} (sin celadora)`;
}

type AsistMap = Map<
  string,
  { estado: string; observacion: string | null }
>;

function buildAsistMap(g: RespaldoGrilla | null): AsistMap {
  const map: AsistMap = new Map();
  if (!g) return map;
  for (const a of g.asistencias) {
    map.set(nombreKey(a.pasajeroNombre), {
      estado: normalizeEstadoAsistenciaFicha(a.estado),
      observacion: a.motivoCancelacion,
    });
  }
  return map;
}

/** Pasajeros únicos asignados en la grilla (filas con pasajero), ordenados por nombre. */
function pasajerosDeGrilla(g: RespaldoGrilla): string[] {
  const seen = new Set<string>();
  const nombres: string[] = [];
  for (const f of g.filas) {
    if (!f.pasajeroId) continue;
    const key = f.pasajeroId;
    if (seen.has(key)) continue;
    seen.add(key);
    const nombre = f.pasajeroNombre.trim();
    if (!nombre) continue;
    nombres.push(nombre);
  }
  return nombres.sort((a, b) => a.localeCompare(b, 'es'));
}

/** Asistencia + observación del sentido de este recorrido. */
function celdaAsistenciaDe(
  pasajeroNombre: string,
  map: AsistMap,
): { estado: string; observacion: string } {
  const row = map.get(nombreKey(pasajeroNombre));
  if (!row) return { estado: '—', observacion: '' };
  return {
    estado: labelEstadoAsistenciaFicha(row.estado),
    observacion: row.observacion?.trim() ?? '',
  };
}

/** Bloque de un recorrido: 3 franjas + tabla Pasajero | Asistencias | Observaciones. */
function renderRecorridoBlock(
  jornada: Pick<RespaldoJornada, 'fecha' | 'area' | 'nombre'>,
  g: RespaldoGrilla,
): string {
  const asistMap = buildAsistMap(g);
  const pasajeros = pasajerosDeGrilla(g);
  const filas = pasajeros
    .map((nombre) => {
      const { estado, observacion } = celdaAsistenciaDe(nombre, asistMap);
      return `<tr>
        <td>${escapeHtml(nombre)}</td>
        <td>${escapeHtml(estado)}</td>
        <td>${escapeHtml(observacion || '—')}</td>
      </tr>`;
    })
    .join('');

  return `
    <section class="recorrido">
      <div class="bar bar--titulo">
        <span>${escapeHtml(formatFechaGrilla(jornada.fecha))}</span>
        <span>·</span>
        <span>${escapeHtml(labelTipoItinerario(g.tipoItinerario))}</span>
        <span>·</span>
        <span>${escapeHtml(g.transporte)}</span>
      </div>
      <div class="bar bar--meta">
        <span><strong>Área:</strong> ${escapeHtml(jornada.area)}</span>
        <span><strong>Nombre:</strong> ${escapeHtml(jornada.nombre)}</span>
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

export function buildGrillasCsv(grillas: RespaldoGrilla[]): string {
  const header = [
    'Fecha',
    'Nombre',
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
        g.nombre,
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
  const jornadas = agruparRespaldoJornadas(grillas);
  const header = [
    'Fecha',
    'Nombre',
    'Modalidad',
    'Area',
    'Pasajero',
    'Ingreso',
    'Obs ingreso',
    'Salida',
    'Obs salida',
    'Vehiculo ingreso',
    'Vehiculo salida',
  ];
  const lines = [header.map(csvEscape).join(',')];

  for (const j of jornadas) {
    const ingMap = buildAsistMap(j.ingreso);
    const salMap = buildAsistMap(j.salida);
    const names = new Set<string>([...ingMap.keys(), ...salMap.keys()]);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'es'));

    for (const key of sorted) {
      const ing = ingMap.get(key);
      const sal = salMap.get(key);
      const displayName =
        j.ingreso?.asistencias.find((a) => nombreKey(a.pasajeroNombre) === key)?.pasajeroNombre ??
        j.salida?.asistencias.find((a) => nombreKey(a.pasajeroNombre) === key)?.pasajeroNombre ??
        key;

      lines.push(
        [
          formatFechaGrilla(j.fecha),
          j.nombre,
          labelModalidadTitulo(j.modalidad),
          j.area,
          displayName,
          ing ? labelEstadoAsistenciaFicha(ing.estado) : '',
          ing?.observacion ?? '',
          sal ? labelEstadoAsistenciaFicha(sal.estado) : '',
          sal?.observacion ?? '',
          j.ingreso?.transporte ?? '',
          j.salida?.transporte ?? '',
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
  const jornadas = agruparRespaldoJornadas(params.grillas);

  const bloques = jornadas
    .map((j) => {
      const recorridos: string[] = [];
      if (j.ingreso) recorridos.push(renderRecorridoBlock(j, j.ingreso));
      if (j.salida) recorridos.push(renderRecorridoBlock(j, j.salida));
      return recorridos.join('');
    })
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.titulo)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111;line-height:1.35}
    h1{font-size:20px;margin:0 0 8px}
    .resumen{margin-bottom:18px;font-size:13px;color:#333}
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
    <div><strong>Jornadas:</strong> ${jornadas.length} · <strong>Grillas:</strong> ${params.grillas.length}</div>
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
