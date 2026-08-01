'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import {
  formatAccionFila,
  formatFechaGrilla,
  labelTipoItinerario,
} from '@/lib/grilla.utils';
import {
  agruparHistorialPorDia,
  labelEstadoAsistenciaFicha,
  type HistorialCeldaFicha,
  type HistorialDiaFicha,
  type HistorialRegistroFicha,
} from '@/lib/pasajero.utils';

type ApiRegistro = {
  id: string;
  estado: string;
  motivoCancelacion: string | null;
  grilla: HistorialRegistroFicha['grilla'];
};

function CeldaHistorial({
  celdas,
  seleccionId,
  onVer,
}: {
  celdas: HistorialCeldaFicha[];
  seleccionId: string | null;
  onVer: (celda: HistorialCeldaFicha) => void;
}) {
  if (celdas.length === 0) {
    return <span className="pasajero-ficha-hist__empty">—</span>;
  }

  return (
    <div className="pasajero-ficha-hist__celda">
      {celdas.map((c) => (
        <div key={c.registroId} className="pasajero-ficha-hist__item">
          {celdas.length > 1 ||
          c.tipoItinerario.startsWith('ADAPTACION') ||
          c.tipoItinerario.startsWith('ESPECIAL') ? (
            <small className="pasajero-ficha-hist__tipo">
              {labelTipoItinerario(c.tipoItinerario)}
            </small>
          ) : null}
          <strong
            className={
              c.estado === 'ASISTIO'
                ? 'pasajero-ficha-hist__ok'
                : 'pasajero-ficha-hist__ko'
            }
          >
            {labelEstadoAsistenciaFicha(c.estado)}
          </strong>
          {c.observacion ? (
            <small className="pasajero-ficha-hist__obs">Obs: {c.observacion}</small>
          ) : null}
          <button
            type="button"
            className={`btn btn--outline btn--sm${seleccionId === c.registroId ? ' is-active' : ''}`}
            onClick={() => onVer(c)}
          >
            {seleccionId === c.registroId ? 'Ocultar grilla' : 'Ver grilla'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function PasajeroFichaHistorial({
  pasajeroId,
  pasajeroNombre,
}: {
  pasajeroId: string;
  pasajeroNombre: string;
}) {
  const popup = usePanelPopup();
  const [registros, setRegistros] = useState<HistorialRegistroFicha[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState<HistorialCeldaFicha | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSeleccion(null);
    try {
      const response = await fetch(`/api/admin/pasajeros/${pasajeroId}/historial`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudo cargar el historial.');
        return;
      }
      const raw = (body.data?.registros ?? []) as ApiRegistro[];
      setRegistros(
        raw.map((r) => ({
          id: r.id,
          estado: r.estado,
          observacion: r.motivoCancelacion,
          grilla: r.grilla,
        })),
      );
    } catch {
      popup.error('Error de conexión al cargar el historial.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable
  }, [pasajeroId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dias: HistorialDiaFicha[] = useMemo(
    () => agruparHistorialPorDia(registros),
    [registros],
  );

  const onVer = (celda: HistorialCeldaFicha) => {
    setSeleccion((cur) => (cur?.registroId === celda.registroId ? null : celda));
  };

  if (loading) {
    return <p className="panel-card__desc">Cargando historial...</p>;
  }

  if (dias.length === 0) {
    return <p className="panel-card__desc">Todavía no hay registros de asistencia.</p>;
  }

  return (
    <div className="pasajero-ficha-hist">
      {popup.popupNode}
      <div className="admin-users__table-wrap">
        <table className="admin-users__table pasajero-ficha-hist__table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Adaptación</th>
              <th>Especial</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((dia) => (
              <tr key={dia.fechaKey}>
                <td>
                  <strong>{formatFechaGrilla(dia.fecha)}</strong>
                </td>
                <td>
                  <CeldaHistorial
                    celdas={dia.ingreso}
                    seleccionId={seleccion?.registroId ?? null}
                    onVer={onVer}
                  />
                </td>
                <td>
                  <CeldaHistorial
                    celdas={dia.salida}
                    seleccionId={seleccion?.registroId ?? null}
                    onVer={onVer}
                  />
                </td>
                <td>
                  <CeldaHistorial
                    celdas={dia.adaptacion}
                    seleccionId={seleccion?.registroId ?? null}
                    onVer={onVer}
                  />
                </td>
                <td>
                  <CeldaHistorial
                    celdas={dia.especial}
                    seleccionId={seleccion?.registroId ?? null}
                    onVer={onVer}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {seleccion && (
        <div className="pasajero-ficha-hist__grilla">
          <h4>
            Grilla · {formatFechaGrilla(seleccion.grilla.fecha)} ·{' '}
            {labelTipoItinerario(seleccion.tipoItinerario)}
          </h4>
          <p className="panel-card__desc">
            {seleccion.grilla.transporte} ({seleccion.grilla.tipoTransporte}) ·{' '}
            {seleccion.grilla.area}
            <br />
            Responsables: {seleccion.grilla.responsables}
            <br />
            Estado: {labelEstadoAsistenciaFicha(seleccion.estado)}
            {seleccion.observacion ? ` · Observación: ${seleccion.observacion}` : ''}
          </p>
          {seleccion.grilla.nota ? (
            <p className="pasajero-ficha-hist__obs">Nota del recorrido: {seleccion.grilla.nota}</p>
          ) : null}
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
                {seleccion.grilla.filas.map((f) => {
                  const esEste =
                    f.pasajeroId === pasajeroId ||
                    f.pasajeroNombre.toLowerCase() === pasajeroNombre.toLowerCase();
                  return (
                    <tr key={f.id} className={esEste ? 'is-selected' : undefined}>
                      <td>{f.hora ?? '—'}</td>
                      <td>{f.direccion}</td>
                      <td>
                        {formatAccionFila({
                          accion: f.accion,
                          pasajeroNombre: f.pasajeroNombre,
                          trasbordoHacia: f.trasbordoHacia,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setSeleccion(null)}
          >
            Cerrar grilla
          </button>
        </div>
      )}
    </div>
  );
}
