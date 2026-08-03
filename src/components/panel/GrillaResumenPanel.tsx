'use client';

import { formatAccionFila, formatFechaGrilla, labelTipoItinerario, type AccionParada } from '@/lib/grilla.utils';

export type GrillaResumenFila = {
  id: string;
  orden?: number;
  hora?: string | null;
  direccion: string;
  pasajeroNombre: string;
  pasajeroId?: string | null;
  destinoId?: string | null;
  accion: string;
  trasbordoHacia?: string | null;
};

export type GrillaResumenData = {
  nombre?: string | null;
  fecha: string | Date;
  tipoItinerario: string;
  nota?: string | null;
  notaRevision?: string | null;
  area: { nombre: string };
  transporte: { nombre: string; tipo?: string };
  chofer: { username: string };
  celadora?: { username: string } | null;
  conCeladora: boolean;
  filas: GrillaResumenFila[];
};

function pasajerosUnicos(filas: GrillaResumenFila[]): string[] {
  const seenId = new Set<string>();
  const seenNombre = new Set<string>();
  const out: string[] = [];
  for (const f of filas) {
    const nombre = f.pasajeroNombre?.trim();
    if (!nombre) continue;
    if (f.pasajeroId) {
      if (seenId.has(f.pasajeroId)) continue;
      seenId.add(f.pasajeroId);
      seenNombre.add(nombre.toLowerCase());
      out.push(nombre);
      continue;
    }
    const key = nombre.toLowerCase();
    if (seenNombre.has(key)) continue;
    seenNombre.add(key);
    out.push(nombre);
  }
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

function destinosUnicos(filas: GrillaResumenFila[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of filas) {
    if (!f.destinoId) continue;
    const label = f.direccion?.trim() || f.pasajeroNombre?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Resumen tipo respaldo para revisión Admin (solo lectura). */
export function GrillaResumenPanel({ grilla }: { grilla: GrillaResumenData }) {
  const responsables = grilla.conCeladora
    ? `${grilla.chofer.username} + ${grilla.celadora?.username ?? '—'}`
    : `${grilla.chofer.username} (sin celadora)`;
  const pasajeros = pasajerosUnicos(grilla.filas);
  const destinos = destinosUnicos(grilla.filas);
  const filasOrdenadas = [...grilla.filas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  return (
    <div className="grilla-resumen">
      <div className="grilla-resumen__meta">
        <span>
          <strong>Área:</strong> {grilla.area.nombre}
        </span>
        <span>
          <strong>Fecha:</strong> {formatFechaGrilla(grilla.fecha)}
        </span>
        <span>
          <strong>Itinerario:</strong> {labelTipoItinerario(grilla.tipoItinerario)}
        </span>
        <span>
          <strong>Vehículo:</strong> {grilla.transporte.nombre}
          {grilla.transporte.tipo ? ` (${grilla.transporte.tipo})` : ''}
        </span>
        <span>
          <strong>Responsables:</strong> {responsables}
        </span>
        {grilla.nombre ? (
          <span>
            <strong>Nombre:</strong> {grilla.nombre}
          </span>
        ) : null}
      </div>

      {grilla.nota ? <p className="grilla-resumen__nota">Nota: {grilla.nota}</p> : null}
      {grilla.notaRevision ? (
        <p className="grilla-resumen__nota">Nota de revisión: {grilla.notaRevision}</p>
      ) : null}

      <div className="grilla-resumen__cols">
        <div>
          <h4>Pasajeros ({pasajeros.length})</h4>
          {pasajeros.length === 0 ? (
            <p className="panel-card__desc">Sin pasajeros.</p>
          ) : (
            <ul className="grilla-resumen__list">
              {pasajeros.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Destinos ({destinos.length})</h4>
          {destinos.length === 0 ? (
            <p className="panel-card__desc">Sin destinos fijos.</p>
          ) : (
            <ul className="grilla-resumen__list">
              {destinos.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h4>Recorrido</h4>
      <div className="admin-users__table-wrap">
        <table className="admin-users__table grilla-preview__table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Parada / dirección</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={3}>Sin paradas.</td>
              </tr>
            ) : (
              filasOrdenadas.map((f) => (
                <tr key={f.id}>
                  <td>{f.hora ?? '—'}</td>
                  <td>{f.direccion}</td>
                  <td>
                    {formatAccionFila({
                      accion: f.accion as AccionParada,
                      pasajeroNombre: f.pasajeroNombre,
                      trasbordoHacia: f.trasbordoHacia,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
