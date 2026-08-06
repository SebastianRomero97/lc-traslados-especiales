'use client';

import { formatFechaGrilla, labelTipoItinerario } from '@/lib/grilla.utils';
import { labelTipoCierre } from '@/lib/grilla-estado';
import {
  labelEstadoAsistenciaFicha,
  normalizeEstadoAsistenciaFicha,
} from '@/lib/pasajero.utils';
import type { GrillaPrintInput } from '@/lib/grilla-print';

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

/** Misma información/layout que la vista Imprimir, embebida en el panel. */
export function GrillaPrintPanel({ grilla }: { grilla: GrillaPrintInput }) {
  const asistMap = new Map<string, { estado: string; observacion: string }>();
  for (const a of grilla.asistencias ?? []) {
    asistMap.set(nombreKey(a.pasajeroNombre), {
      estado: normalizeEstadoAsistenciaFicha(a.estado),
      observacion: a.motivoCancelacion?.trim() ?? '',
    });
  }
  const pasajeros = pasajerosUnicos(grilla);
  const cierreLabel = labelTipoCierre(grilla.cierreTipo);
  const mostrarCierre =
    Boolean(cierreLabel) &&
    (grilla.cierreTipo === 'FORZADO_ADMIN' || grilla.cierreTipo === 'INTERRUMPIDO');

  return (
    <div className="grilla-print-panel">
      <div className="grilla-print-panel__bar grilla-print-panel__bar--titulo">
        <span>{formatFechaGrilla(grilla.fecha)}</span>
        <span aria-hidden="true">·</span>
        <span>{labelTipoItinerario(grilla.tipoItinerario)}</span>
        <span aria-hidden="true">·</span>
        <span>{grilla.transporteNombre}</span>
      </div>
      <div className="grilla-print-panel__bar grilla-print-panel__bar--meta">
        <span>
          <strong>Área:</strong> {grilla.areaNombre}
        </span>
        <span>
          <strong>Nombre:</strong> {grilla.nombre || 'Sin nombre'}
        </span>
        <span>
          <strong>Responsables:</strong> {responsablesDe(grilla)}
        </span>
      </div>
      {mostrarCierre && cierreLabel ? (
        <div className="grilla-print-panel__bar grilla-print-panel__bar--meta">
          <span>
            <strong>Cierre:</strong> {cierreLabel}
          </span>
          {grilla.cerradoPorNombre ? (
            <span>
              <strong>Por:</strong> {grilla.cerradoPorNombre}
            </span>
          ) : null}
          {grilla.cerradoAt ? (
            <span>
              <strong>Cuando:</strong>{' '}
              {new Date(grilla.cerradoAt).toLocaleString('es-AR')}
            </span>
          ) : null}
          {grilla.cierreNota ? (
            <span>
              <strong>Observación:</strong> {grilla.cierreNota}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="admin-users__table-wrap">
        <table className="admin-users__table grilla-print-panel__table">
          <thead>
            <tr>
              <th>Pasajero</th>
              <th>Asistencias</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {pasajeros.length === 0 ? (
              <tr>
                <td colSpan={3}>Sin pasajeros en este recorrido.</td>
              </tr>
            ) : (
              pasajeros.map((nombre) => {
                const row = asistMap.get(nombreKey(nombre));
                return (
                  <tr key={nombre}>
                    <td>{nombre}</td>
                    <td>{row ? labelEstadoAsistenciaFicha(row.estado) : '—'}</td>
                    <td>{row?.observacion ? row.observacion : '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
