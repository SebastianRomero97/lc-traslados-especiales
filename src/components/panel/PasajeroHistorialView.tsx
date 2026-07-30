'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAccionFila, formatFechaGrilla, labelTipoItinerario } from '@/lib/grilla.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type EstadoAsistencia = 'ASISTIO' | 'CANCELO' | 'NO_SE_PRESENTO';

type Registro = {
  id: string;
  estado: EstadoAsistencia;
  motivoCancelacion: string | null;
  grilla: {
    id: string;
    fecha: string;
    tipoItinerario: string;
    nota: string | null;
    area: string;
    transporte: string;
    tipoTransporte: string;
    responsables: string;
    filas: {
      id: string;
      hora: string | null;
      direccion: string;
      pasajeroNombre: string;
      pasajeroId: string | null;
      accion: string;
      trasbordoHacia: string | null;
    }[];
  };
};

type HistorialData = {
  pasajero: {
    id: string;
    nombre: string;
    direccion: string;
    active: boolean;
    createdAt: string;
  };
  areas: {
    id: string;
    nombre: string;
    active: boolean;
    destino: {
      id: string;
      nombre: string;
      domicilio: string;
      active: boolean;
    } | null;
  }[];
  transportes: {
    id: string;
    nombre: string;
    tipo: string;
    active: boolean;
    areas: string[];
    viajes: number;
  }[];
  resumen: {
    totalRegistros: number;
    asistio: number;
    faltas: number;
    cancelo: number;
    noSePresento: number;
  };
  faltasDetalle: {
    id: string;
    estado: 'CANCELO' | 'NO_SE_PRESENTO';
    motivoCancelacion: string | null;
    fecha: string;
    tipoItinerario: string;
    area: string;
    transporte: string;
    responsables: string;
  }[];
  registros: Registro[];
  grafica: { label: string; value: number }[];
};

type FiltroModal = 'ASISTIO' | 'FALTAS' | 'CANCELO' | 'NO_SE_PRESENTO';

function filtroLabel(f: FiltroModal): string {
  if (f === 'ASISTIO') return 'Asistencias';
  if (f === 'FALTAS') return 'Faltas';
  if (f === 'CANCELO') return 'Canceló';
  return 'No se presentó';
}

function estadoLabel(e: EstadoAsistencia): string {
  if (e === 'ASISTIO') return 'Asistió';
  if (e === 'CANCELO') return 'Canceló';
  return 'No se presentó';
}

export function PasajeroHistorialView({
  pasajeroId,
  onBack,
}: {
  pasajeroId: string;
  onBack: () => void;
}) {
  const popup = usePanelPopup();
  const [data, setData] = useState<HistorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalFiltro, setModalFiltro] = useState<FiltroModal | null>(null);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<Registro | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/pasajeros/${pasajeroId}/historial`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudo cargar el historial.');
        return;
      }
      setData(body.data as HistorialData);
    } catch {
      popup.error('Error de conexión al cargar el historial.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasajeroId]);

  useEffect(() => {
    void load();
  }, [load]);

  const registrosFiltrados = useMemo(() => {
    if (!data || !modalFiltro) return [];
    if (modalFiltro === 'FALTAS') {
      return data.registros.filter(
        (r) => r.estado === 'CANCELO' || r.estado === 'NO_SE_PRESENTO',
      );
    }
    return data.registros.filter((r) => r.estado === modalFiltro);
  }, [data, modalFiltro]);

  const openFiltro = (filtro: FiltroModal) => {
    setModalFiltro(filtro);
    setRegistroSeleccionado(null);
  };

  const closeModal = () => {
    setModalFiltro(null);
    setRegistroSeleccionado(null);
  };

  useEffect(() => {
    if (!modalFiltro) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (registroSeleccionado) setRegistroSeleccionado(null);
        else closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalFiltro, registroSeleccionado]);

  if (loading && !data) {
    return (
      <div className="pasajero-historial">
        {popup.popupNode}
        <p className="panel-card__desc">Cargando historial...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pasajero-historial">
        {popup.popupNode}
        <button type="button" className="btn btn--outline btn--sm" onClick={onBack}>
          ← Volver al listado
        </button>
        <p className="panel-card__desc">No se pudo cargar el historial.</p>
      </div>
    );
  }

  const maxBar = Math.max(1, ...data.grafica.map((g) => g.value));

  return (
    <div className="pasajero-historial">
      {popup.popupNode}

      <div className="pasajero-historial__toolbar">
        <button type="button" className="btn btn--outline btn--sm" onClick={onBack}>
          ← Volver al listado
        </button>
      </div>

      <section className="panel-card">
        <h2>Historial: {data.pasajero.nombre}</h2>
        <dl className="pasajero-historial__datos">
          <div>
            <dt>Nombre</dt>
            <dd>{data.pasajero.nombre}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{data.pasajero.direccion}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{data.pasajero.active ? 'Activo' : 'Inactivo'}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{new Date(data.pasajero.createdAt).toLocaleDateString('es-AR')}</dd>
          </div>
        </dl>
      </section>

      <div className="informe-columns">
        <section className="panel-card">
          <h2>Áreas y destinos</h2>
          {data.areas.length === 0 ? (
            <p className="panel-card__desc">Sin áreas asignadas.</p>
          ) : (
            <ul className="pasajero-historial__list">
              {data.areas.map((a) => (
                <li key={a.id}>
                  <strong>
                    {a.nombre}
                    {!a.active ? ' (inactiva)' : ''}
                  </strong>
                  <span>
                    Destino:{' '}
                    {a.destino
                      ? `${a.destino.nombre}${!a.destino.active ? ' (inactivo)' : ''}`
                      : 'Sin destino asignado'}
                  </span>
                  {a.destino && <small>{a.destino.domicilio}</small>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card">
          <h2>Transportes</h2>
          <p className="panel-card__desc">
            Vehículos en cuyas grillas figuró este pasajero.
          </p>
          {data.transportes.length === 0 ? (
            <p className="panel-card__desc">
              Todavía no aparece en ninguna grilla; no hay vehículo asociado.
            </p>
          ) : (
            <ul className="pasajero-historial__list">
              {data.transportes.map((t) => (
                <li key={t.id}>
                  <strong>
                    {t.nombre} ({t.tipo})
                    {!t.active ? ' — no disponible' : ''}
                  </strong>
                  <span>
                    {t.viajes} grilla{t.viajes === 1 ? '' : 's'} · Área(s): {t.areas.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel-card">
        <h2>Asistencias y faltas</h2>
        <p className="panel-card__desc">
          Hacé click en un total para ver los días y luego la grilla.
        </p>
        <div className="informe-stat-grid">
          <button
            type="button"
            className="informe-stat informe-stat--clickable"
            onClick={() => openFiltro('ASISTIO')}
          >
            <span>Asistencias</span>
            <strong>{data.resumen.asistio}</strong>
          </button>
          <button
            type="button"
            className="informe-stat informe-stat--clickable"
            onClick={() => openFiltro('FALTAS')}
          >
            <span>Faltas</span>
            <strong>{data.resumen.faltas}</strong>
          </button>
          <button
            type="button"
            className="informe-stat informe-stat--clickable"
            onClick={() => openFiltro('CANCELO')}
          >
            <span>Canceló</span>
            <strong>{data.resumen.cancelo}</strong>
          </button>
          <button
            type="button"
            className="informe-stat informe-stat--clickable"
            onClick={() => openFiltro('NO_SE_PRESENTO')}
          >
            <span>No se presentó</span>
            <strong>{data.resumen.noSePresento}</strong>
          </button>
        </div>

        <h3 className="pasajero-historial__subtitulo">Comparativa</h3>
        <ul className="informe-bars">
          {data.grafica.map((g) => (
            <li key={g.label}>
              <div className="informe-bars__meta">
                <span>{g.label}</span>
                <strong>{g.value}</strong>
              </div>
              <div className="informe-bars__track" aria-hidden="true">
                <div
                  className={`informe-bars__fill${g.label === 'Faltas' ? ' is-faltas' : ''}`}
                  style={{ width: `${Math.round((g.value / maxBar) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card">
        <h2>Detalle de faltas</h2>
        {data.faltasDetalle.length === 0 ? (
          <p className="panel-card__desc">No hay faltas registradas.</p>
        ) : (
          <ul className="pasajero-historial__faltas">
            {data.faltasDetalle.map((f) => (
              <li key={f.id}>
                <strong>
                  {formatFechaGrilla(f.fecha)} ·{' '}
                  {labelTipoItinerario(f.tipoItinerario)} · {f.transporte}
                </strong>
                <span>
                  {f.estado === 'CANCELO' ? 'Canceló' : 'No se presentó'} · {f.area} ·{' '}
                  {f.responsables}
                </span>
                {f.motivoCancelacion && (
                  <p className="pasajero-historial__motivo">Motivo: {f.motivoCancelacion}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalFiltro && (
        <div className="panel-popup" role="presentation" onClick={closeModal}>
          <div
            className="panel-popup__card pasajero-historial-modal"
            role="dialog"
            aria-modal="true"
            aria-label={filtroLabel(modalFiltro)}
            onClick={(e) => e.stopPropagation()}
          >
            {!registroSeleccionado ? (
              <>
                <h3 className="panel-popup__title">{filtroLabel(modalFiltro)}</h3>
                <p className="panel-popup__message">
                  Elegí un día para ver la grilla completa.
                </p>
                {registrosFiltrados.length === 0 ? (
                  <p className="panel-card__desc">No hay registros en esta categoría.</p>
                ) : (
                  <ul className="pasajero-historial-modal__dias">
                    {registrosFiltrados.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="pasajero-historial-modal__dia"
                          onClick={() => setRegistroSeleccionado(r)}
                        >
                          <strong>
                            {formatFechaGrilla(r.grilla.fecha)} ·{' '}
                            {labelTipoItinerario(r.grilla.tipoItinerario)}
                          </strong>
                          <span>
                            {r.grilla.transporte} · {r.grilla.area} · {estadoLabel(r.estado)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="panel-popup__actions">
                  <button type="button" className="btn btn--outline" onClick={closeModal}>
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="panel-popup__title">
                  Grilla · {formatFechaGrilla(registroSeleccionado.grilla.fecha)}
                </h3>
                <p className="panel-popup__message">
                  {labelTipoItinerario(registroSeleccionado.grilla.tipoItinerario)}{' '}
                  · {registroSeleccionado.grilla.transporte} (
                  {registroSeleccionado.grilla.tipoTransporte}) ·{' '}
                  {registroSeleccionado.grilla.area}
                  <br />
                  Responsables: {registroSeleccionado.grilla.responsables}
                  <br />
                  Estado del pasajero: {estadoLabel(registroSeleccionado.estado)}
                  {registroSeleccionado.motivoCancelacion
                    ? ` · Motivo: ${registroSeleccionado.motivoCancelacion}`
                    : ''}
                </p>
                {registroSeleccionado.grilla.nota && (
                  <p className="pasajero-historial__motivo">
                    Nota: {registroSeleccionado.grilla.nota}
                  </p>
                )}
                <div className="admin-users__table-wrap pasajero-historial-modal__table">
                  <table className="admin-users__table grilla-preview__table">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Parada / dirección</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registroSeleccionado.grilla.filas.map((f) => {
                        const esEste =
                          f.pasajeroId === data.pasajero.id ||
                          f.pasajeroNombre.toLowerCase() ===
                            data.pasajero.nombre.toLowerCase();
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
                <div className="panel-popup__actions">
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => setRegistroSeleccionado(null)}
                  >
                    ← Días
                  </button>
                  <button type="button" className="btn btn--primary" onClick={closeModal}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
