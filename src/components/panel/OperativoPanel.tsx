'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { ChoferVehiculoSection } from '@/components/panel/ChoferVehiculoSection';
import { PasajeroContactoModal } from '@/components/panel/PasajeroContactoModal';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import {
  buildGrillaTitulo,
  formatAccionFila,
  formatFechaGrilla,
  labelTipoItinerario,
} from '@/lib/grilla.utils';
import {
  extractItemsParaControl,
  formatDuration,
  labelsParaControl,
  navUrlsParaChofer,
  NIVELES_COMBUSTIBLE,
  NIVEL_COMBUSTIBLE_LABEL,
  type EstadoAsistencia,
  type NivelCombustible,
} from '@/lib/operativo.utils';

type Asistencia = {
  id: string;
  pasajeroNombre: string;
  pasajeroId: string | null;
  estado: EstadoAsistencia;
  motivoCancelacion: string | null;
};

type GrillaOperativa = {
  id: string;
  nombre?: string | null;
  tipoItinerario: string;
  fecha: string;
  nota: string | null;
  estado?: string;
  cierreTipo?: string | null;
  conCeladora: boolean;
  choferInicioAt: string | null;
  choferFinAt: string | null;
  celadoraInicioAt: string | null;
  celadoraFinAt: string | null;
  informeChofer: string | null;
  informeCeladora: string | null;
  informeChoferCeladora: string | null;
  informeChoferVehiculo: string | null;
  combustibleNivel: NivelCombustible | null;
  area: { id: string; nombre: string };
  transporte: { id: string; nombre: string; tipo: string };
  chofer: { id: string; username: string };
  celadora: { id: string; username: string } | null;
  puntoEncuentro?: {
    id: string;
    nombre: string | null;
    direccion: string;
    frecuente: boolean;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
  } | null;
  filas: {
    id: string;
    hora: string | null;
    direccion: string;
    pasajeroNombre: string;
    pasajeroId: string | null;
    destinoId: string | null;
    accion: 'SUBE' | 'BAJA' | 'TRASBORDO';
    trasbordoHacia: string | null;
    lat?: number | null;
    lon?: number | null;
    usarCoordsParaChofer?: boolean;
  }[];
  asistencias: Asistencia[];
};

function isJornadaCerradaGrilla(g: GrillaOperativa, rol: 'CELADORA' | 'CHOFER'): boolean {
  if (g.estado === 'FINALIZADA' || g.cierreTipo) return true;
  if (rol === 'CELADORA') return Boolean(g.informeCeladora?.trim());
  return Boolean(g.informeChofer?.trim() || g.combustibleNivel);
}

type SeccionOperativo = 'principal' | 'historial' | 'vehiculo';

export function OperativoPanel({
  rol,
  isPrestador = false,
}: {
  rol: 'CELADORA' | 'CHOFER';
  isPrestador?: boolean;
}) {
  const popup = usePanelPopup();
  const [grillas, setGrillas] = useState<GrillaOperativa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<SeccionOperativo>('principal');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [fichaPasajero, setFichaPasajero] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [informe, setInforme] = useState('');
  const [choferForm, setChoferForm] = useState({
    celadora: '',
    vehiculo: '',
    combustible: '' as '' | NivelCombustible,
  });

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const response = await fetch(`/api/operativo/grillas?rol=${rol}`);
      const body = await response.json();
      if (!response.ok) {
        if (!opts?.silent) {
          popup.error(body.message ?? 'No se pudieron cargar las grillas.');
        }
        return;
      }
      const list = body.data as GrillaOperativa[];
      setGrillas(list);
      setSelectedId((current) => {
        if (current && list.some((g) => g.id === current)) return current;
        const activas = list.filter((g) => !isJornadaCerradaGrilla(g, rol));
        return activas[0]?.id ?? list[0]?.id ?? null;
      });
    } catch {
      if (!opts?.silent) {
        popup.error('Error de conexión al cargar grillas.');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresco periódico para enterarse de cierres Admin / cambios de estado.
  useEffect(() => {
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, 30_000);
    const onFocus = () => {
      void load({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const selected = useMemo(
    () => grillas.find((g) => g.id === selectedId) ?? null,
    [grillas, selectedId],
  );

  const grillasActivas = useMemo(
    () => grillas.filter((g) => !isJornadaCerradaGrilla(g, rol)),
    [grillas, rol],
  );
  const grillasHistorial = useMemo(
    () => grillas.filter((g) => isJornadaCerradaGrilla(g, rol)),
    [grillas, rol],
  );
  const grillasSeccion = seccion === 'historial' ? grillasHistorial : grillasActivas;

  useEffect(() => {
    if (seccion === 'vehiculo') return;
    setSelectedId((current) => {
      if (current && grillasSeccion.some((g) => g.id === current)) return current;
      return grillasSeccion[0]?.id ?? null;
    });
  }, [seccion, grillasSeccion]);

  useEffect(() => {
    if (!selected) {
      setInforme('');
      setChoferForm({ celadora: '', vehiculo: '', combustible: '' });
      return;
    }
    setInforme(
      rol === 'CELADORA' ? selected.informeCeladora ?? '' : selected.informeChofer ?? '',
    );
    setChoferForm({
      celadora: selected.informeChoferCeladora ?? '',
      vehiculo: selected.informeChoferVehiculo ?? '',
      combustible: selected.combustibleNivel ?? '',
    });
  }, [selected, rol]);

  const replaceGrilla = (updated: GrillaOperativa) => {
    setGrillas((prev) => prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)));
  };

  const patchAsistenciaLocal = (asistencia: Asistencia) => {
    if (!selected) return;
    const nextAsistencias = [...selected.asistencias];
    const idx = nextAsistencias.findIndex(
      (a) => a.pasajeroNombre.toLowerCase() === asistencia.pasajeroNombre.toLowerCase(),
    );
    if (idx >= 0) nextAsistencias[idx] = asistencia;
    else nextAsistencias.push(asistencia);
    replaceGrilla({ ...selected, asistencias: nextAsistencias });
  };

  const iniciarFin = async (action: 'iniciar' | 'finalizar') => {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/operativo/grillas/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rol }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo actualizar el recorrido.'));
        return;
      }
      const body = (await response.json()) as { data: GrillaOperativa; message?: string };
      replaceGrilla(body.data);
      popup.success(body.message ?? 'Actualizado.');
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setBusy(false);
    }
  };

  const saveAsistencia = async (
    pasajeroNombre: string,
    pasajeroId: string | null,
    estado: EstadoAsistencia,
  ) => {
    if (!selected) return;
    const motivo = estado === 'CANCELO' ? motivos[pasajeroNombre]?.trim() || null : null;
    setBusy(true);
    try {
      const response = await fetch(`/api/operativo/grillas/${selected.id}/asistencia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol,
          pasajeroNombre,
          pasajeroId,
          estado,
          motivoCancelacion: motivo,
        }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo guardar la asistencia.'));
        return;
      }
      const body = (await response.json()) as { data: Asistencia; message?: string };
      patchAsistenciaLocal(body.data);
      popup.success(body.message ?? 'Asistencia guardada.');
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setBusy(false);
    }
  };

  const saveInforme = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const payload =
        rol === 'CELADORA'
          ? { rol, informe }
          : {
              rol,
              informeChoferCeladora: selected.conCeladora ? choferForm.celadora : '',
              informeChoferVehiculo: choferForm.vehiculo,
              combustibleNivel: isPrestador ? null : choferForm.combustible,
            };

      const response = await fetch(`/api/operativo/grillas/${selected.id}/informe`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo guardar el informe.'));
        return;
      }
      const body = (await response.json()) as {
        data: Partial<GrillaOperativa>;
        message?: string;
      };
      replaceGrilla({ ...selected, ...body.data });
      popup.success(
        body.message ??
          'Jornada Completada Exitosamente, Gracias por tu compromiso con LC',
        'Jornada completada',
      );
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setBusy(false);
    }
  };

  const inicioAt = rol === 'CELADORA' ? selected?.celadoraInicioAt : selected?.choferInicioAt;
  const finAt = rol === 'CELADORA' ? selected?.celadoraFinAt : selected?.choferFinAt;
  const jornadaCerrada =
    rol === 'CELADORA'
      ? Boolean(selected?.informeCeladora?.trim())
      : Boolean(selected?.informeChofer?.trim() || selected?.combustibleNivel);
  const puedeAsistencia =
    selected &&
    (rol === 'CELADORA' ? selected.conCeladora : !selected.conCeladora);

  const choferInformeListo =
    Boolean(choferForm.vehiculo.trim()) &&
    (isPrestador || Boolean(choferForm.combustible)) &&
    (!selected?.conCeladora || Boolean(choferForm.celadora.trim()));

  const itemsControl = selected ? extractItemsParaControl(selected.filas) : [];

  const asistenciaMap = useMemo(() => {
    const map = new Map<string, Asistencia>();
    for (const a of selected?.asistencias ?? []) {
      map.set(a.pasajeroNombre.toLowerCase(), a);
    }
    return map;
  }, [selected]);

  return (
    <div className="operativo-panel">
      {popup.popupNode}

      <div className="admin-tabs-shell">
        <div className="admin-tabs" role="tablist" aria-label="Secciones del panel operativo">
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${seccion === 'principal' ? ' is-active' : ''}`}
            aria-selected={seccion === 'principal'}
            onClick={() => setSeccion('principal')}
          >
            Principal{grillasActivas.length > 0 ? ` (${grillasActivas.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${seccion === 'historial' ? ' is-active' : ''}`}
            aria-selected={seccion === 'historial'}
            onClick={() => setSeccion('historial')}
          >
            Historial{grillasHistorial.length > 0 ? ` (${grillasHistorial.length})` : ''}
          </button>
          {rol === 'CHOFER' && (
            <button
              type="button"
              role="tab"
              className={`admin-tabs__btn${seccion === 'vehiculo' ? ' is-active' : ''}`}
              aria-selected={seccion === 'vehiculo'}
              onClick={() => setSeccion('vehiculo')}
            >
              Vehículo asignado
            </button>
          )}
        </div>

        <div className="admin-tabs__panel" role="tabpanel">
      {seccion === 'vehiculo' && rol === 'CHOFER' ? (
        <ChoferVehiculoSection isPrestador={isPrestador} />
      ) : loading ? (
        <p className="panel-card__desc">Cargando grillas asignadas...</p>
      ) : grillasSeccion.length === 0 ? (
        <section className="panel-card panel-card--nested">
          <h2>{seccion === 'historial' ? 'Historial' : 'Principal'}</h2>
          <p className="panel-card__desc">
            {seccion === 'historial'
              ? 'Todavía no hay grillas completadas.'
              : 'No hay grillas nuevas asignadas. Cuando Administración te asigne una, va a aparecer acá.'}
          </p>
        </section>
      ) : (
        <>
          <section className="panel-card">
            <h2>{seccion === 'historial' ? 'Grillas completadas' : 'Grillas nuevas'}</h2>
            <p className="panel-card__desc">
              {seccion === 'historial'
                ? 'Solo lectura: jornadas ya cerradas con informe.'
                : 'Grillas pendientes de realizar o en curso.'}
            </p>
            <div className="operativo-grilla-list">
              {grillasSeccion.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`operativo-grilla-pill${selectedId === g.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(g.id)}
                >
                  <strong>{formatFechaGrilla(g.fecha)}</strong>
                  <span>
                    {g.nombre ? `${g.nombre} · ` : ''}
                    {labelTipoItinerario(g.tipoItinerario)} · {g.transporte.nombre}
                  </span>
                </button>
              ))}
            </div>
          </section>

              {selected && (
            <>
              <section className="panel-card">
                <h2>
                  {selected.nombre ? `${selected.nombre} — ` : ''}
                  {buildGrillaTitulo({
                    tipoItinerario: selected.tipoItinerario,
                    transporteNombre: selected.transporte.nombre,
                    fecha: selected.fecha,
                  })}
                </h2>
                <p className="panel-card__desc">
                  Área: {selected.area.nombre} · Chofer: {selected.chofer.username}
                  {selected.conCeladora
                    ? ` · Celadora: ${selected.celadora?.username ?? '—'}`
                    : ' · Sin celadora'}
                  {' · '}Tipo: {selected.transporte.tipo}
                </p>
                {selected.conCeladora && (
                  <p className="panel-card__desc" style={{ marginTop: '-0.35rem' }}>
                    Punto de encuentro:{' '}
                    {selected.puntoEncuentro
                      ? selected.puntoEncuentro.nombre
                        ? `${selected.puntoEncuentro.nombre} — ${selected.puntoEncuentro.direccion}`
                        : selected.puntoEncuentro.direccion
                      : 'Parte de base (sin punto aparte)'}
                  </p>
                )}
                {selected.nota && <p className="grilla-preview__nota">{selected.nota}</p>}

                <div className="operativo-reloj">
                  <div>
                    <strong>
                      {rol === 'CELADORA' ? 'Recorrido (pasajeros)' : 'Manejo (vehículo)'}
                    </strong>
                    <p className="panel-card__desc" style={{ marginBottom: 0 }}>
                      {inicioAt
                        ? `Inicio: ${new Date(inicioAt).toLocaleString('es-AR')}`
                        : 'Aún no iniciado'}
                      {finAt ? ` · Fin: ${new Date(finAt).toLocaleString('es-AR')}` : ''}
                      {formatDuration(inicioAt, finAt)
                        ? ` · Duración: ${formatDuration(inicioAt, finAt)}`
                        : ''}
                    </p>
                  </div>
                  <div className="admin-actions">
                    {!inicioAt && !jornadaCerrada && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() => void iniciarFin('iniciar')}
                      >
                        {rol === 'CELADORA' ? 'Iniciar recorrido' : 'Iniciar manejo'}
                      </button>
                    )}
                    {inicioAt && !finAt && !jornadaCerrada && (
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={busy}
                        onClick={() => void iniciarFin('finalizar')}
                      >
                        {rol === 'CELADORA' ? 'Finalizar recorrido' : 'Finalizar manejo'}
                      </button>
                    )}
                    {jornadaCerrada ? (
                      <span className="role-badge role-badge--celadora">Jornada cerrada</span>
                    ) : inicioAt && finAt ? (
                      <span className="role-badge role-badge--chofer">Pendiente informe</span>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* Celadora: el informe va arriba al finalizar, para que no pase desapercibido */}
              {rol === 'CELADORA' && finAt && (
                <section className="panel-card panel-card--informe-destacado">
                  <h2>Informe de observaciones</h2>
                  {jornadaCerrada ? (
                    <div className="operativo-jornada-ok" role="status">
                      <p className="operativo-jornada-ok__title">
                        Jornada Completada Exitosamente
                      </p>
                      <p>Gracias por tu compromiso con LC</p>
                      <p className="panel-card__desc" style={{ marginBottom: 0, marginTop: '0.75rem' }}>
                        Esta grilla quedó cerrada: ya no se pueden modificar asistencias ni el
                        informe.
                      </p>
                      {informe.trim() && (
                        <blockquote className="operativo-informe-readonly">{informe}</blockquote>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="panel-card__desc">
                        Al guardar el informe se cierra la jornada (punto de no retorno). Visible
                        para Admin y Administración.
                      </p>
                      <textarea
                        className="operativo-informe"
                        rows={4}
                        value={informe}
                        onChange={(e) => setInforme(e.target.value)}
                        placeholder="Observaciones del recorrido..."
                      />
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy || !informe.trim()}
                        onClick={() => void saveInforme()}
                      >
                        Guardar informe y cerrar jornada
                      </button>
                    </>
                  )}
                </section>
              )}

              {rol === 'CELADORA' ? (
                <section className="panel-card">
                  <h2>Ruta</h2>
                  <p className="panel-card__desc">
                    Marcá asistencia una vez por pasajero. En destinos: Completado u Observación.
                    {!inicioAt && ' Podés registrar desde el inicio del recorrido.'}
                  </p>
                  {selected.filas.length === 0 ? (
                    <p className="panel-card__desc">Esta grilla no tiene paradas.</p>
                  ) : (
                    <ul className="operativo-ruta-list">
                      {selected.filas.map((f) => {
                        const esDestino = Boolean(f.destinoId) && !f.pasajeroId;
                        const keyNombre = f.pasajeroNombre.trim();
                        const actual = asistenciaMap.get(keyNombre.toLowerCase());
                        const locked = busy || Boolean(finAt) || jornadaCerrada;
                        const mostrarObs =
                          esDestino
                            ? actual?.estado === 'CANCELO' ||
                              motivos[keyNombre] !== undefined
                            : actual?.estado === 'CANCELO' ||
                              motivos[keyNombre] !== undefined;

                        return (
                          <li key={f.id} className="operativo-ruta-item">
                            <div className="operativo-ruta-item__meta">
                              <span className="operativo-ruta-item__hora">
                                {f.hora?.trim() || '—'}
                              </span>
                              <div className="operativo-ruta-item__detalle">
                                <span className="operativo-item-tipo">
                                  {esDestino ? 'Destino' : 'Pasajero'}
                                </span>
                                {!esDestino && f.pasajeroId ? (
                                  <button
                                    type="button"
                                    className="operativo-pasajero-link"
                                    onClick={() =>
                                      setFichaPasajero({
                                        id: f.pasajeroId!,
                                        nombre: keyNombre || 'Pasajero',
                                      })
                                    }
                                  >
                                    {keyNombre || '—'}
                                  </button>
                                ) : (
                                  <strong>{keyNombre || '—'}</strong>
                                )}
                                <span className="operativo-ruta-item__accion">
                                  {f.accion === 'SUBE'
                                    ? 'Sube'
                                    : f.accion === 'BAJA'
                                      ? 'Baja'
                                      : f.trasbordoHacia?.trim()
                                        ? `Trasbordo → ${f.trasbordoHacia.trim()}`
                                        : 'Trasbordo'}
                                </span>
                                {actual && (
                                  <span className="operativo-asistencia-estado">
                                    ·{' '}
                                    {esDestino
                                      ? actual.estado === 'ASISTIO'
                                        ? 'Completado'
                                        : 'Con observación'
                                      : actual.estado === 'ASISTIO'
                                        ? 'Asistió'
                                        : 'Canceló'}
                                    {actual.motivoCancelacion
                                      ? ` (${actual.motivoCancelacion})`
                                      : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            {puedeAsistencia && keyNombre && (
                              <div className="operativo-ruta-item__acciones">
                                {esDestino ? (
                                  <>
                                    <button
                                      type="button"
                                      className={`btn btn--sm${
                                        actual?.estado === 'ASISTIO'
                                          ? ' btn--primary'
                                          : ' btn--outline'
                                      }`}
                                      disabled={locked}
                                      onClick={() =>
                                        void saveAsistencia(keyNombre, f.pasajeroId, 'ASISTIO')
                                      }
                                    >
                                      Completado
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn--sm${
                                        actual?.estado === 'CANCELO'
                                          ? ' btn--primary'
                                          : ' btn--outline'
                                      }`}
                                      disabled={locked}
                                      onClick={() => {
                                        setMotivos((prev) =>
                                          prev[keyNombre] !== undefined
                                            ? prev
                                            : { ...prev, [keyNombre]: actual?.motivoCancelacion ?? '' },
                                        );
                                        void saveAsistencia(keyNombre, f.pasajeroId, 'CANCELO');
                                      }}
                                    >
                                      Observación
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className={`btn btn--sm${
                                        actual?.estado === 'ASISTIO'
                                          ? ' btn--primary'
                                          : ' btn--outline'
                                      }`}
                                      disabled={locked}
                                      onClick={() =>
                                        void saveAsistencia(keyNombre, f.pasajeroId, 'ASISTIO')
                                      }
                                    >
                                      Asistió
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn--sm${
                                        actual?.estado === 'CANCELO'
                                          ? ' btn--primary'
                                          : ' btn--outline'
                                      }`}
                                      disabled={locked}
                                      onClick={() => {
                                        setMotivos((prev) =>
                                          prev[keyNombre] !== undefined
                                            ? prev
                                            : { ...prev, [keyNombre]: actual?.motivoCancelacion ?? '' },
                                        );
                                        void saveAsistencia(keyNombre, f.pasajeroId, 'CANCELO');
                                      }}
                                    >
                                      Canceló
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {puedeAsistencia && mostrarObs && keyNombre && (
                              <input
                                className="operativo-motivo"
                                placeholder={
                                  esDestino
                                    ? 'Observación (opcional)'
                                    : 'Observación (ej. no se presentó, canceló el viaje…)'
                                }
                                value={
                                  motivos[keyNombre] ?? actual?.motivoCancelacion ?? ''
                                }
                                disabled={locked}
                                onChange={(e) =>
                                  setMotivos((prev) => ({
                                    ...prev,
                                    [keyNombre]: e.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  if (actual?.estado === 'CANCELO') {
                                    void saveAsistencia(keyNombre, f.pasajeroId, 'CANCELO');
                                  }
                                }}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ) : (
                <>
                  <section className="panel-card">
                    <h2>Itinerario</h2>
                    <div className="admin-users__table-wrap">
                      <table className="admin-users__table">
                        <thead>
                          <tr>
                            <th>Hora</th>
                            <th>Parada / dirección</th>
                            <th>Acción</th>
                            <th>Mapa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.filas.map((f) => (
                            <tr key={f.id}>
                              <td>{f.hora ?? '—'}</td>
                              <td>{f.direccion}</td>
                              <td>
                                {formatAccionFila({
                                  accion: f.accion,
                                  pasajeroNombre: f.pasajeroNombre,
                                  trasbordoHacia: f.trasbordoHacia,
                                })}
                              </td>
                              <td className="admin-actions">
                                {f.direccion.trim() ? (
                                  <>
                                    {(() => {
                                      const urls = navUrlsParaChofer({
                                        direccion: f.direccion,
                                        lat: f.lat,
                                        lon: f.lon,
                                        usarCoordsParaChofer: f.usarCoordsParaChofer,
                                      });
                                      return (
                                        <>
                                          <a
                                            className="btn btn--outline btn--sm"
                                            href={urls.maps}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            Maps
                                          </a>
                                          <a
                                            className="btn btn--outline btn--sm"
                                            href={urls.waze}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            Waze
                                          </a>
                                        </>
                                      );
                                    })()}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {puedeAsistencia && (
                    <section className="panel-card">
                      <h2>Asistencia y destinos</h2>
                      <p className="panel-card__desc">
                        En pasajeros marcá la asistencia. En destinos, si la llegada se completó.
                        {!inicioAt && ' (Podés registrar desde el inicio del recorrido.)'}
                      </p>
                      {itemsControl.length === 0 ? (
                        <p className="panel-card__desc">
                          Esta grilla no tiene pasajeros ni destinos para marcar.
                        </p>
                      ) : (
                        <ul className="operativo-asistencia-list">
                          {itemsControl.map((item) => {
                            const labels = labelsParaControl(item.tipo);
                            const actual = asistenciaMap.get(item.pasajeroNombre.toLowerCase());
                            return (
                              <li
                                key={`${item.tipo}-${item.pasajeroNombre}`}
                                className="operativo-asistencia-item"
                              >
                                <div>
                                  <span className="operativo-item-tipo">
                                    {item.tipo === 'destino' ? 'Destino' : 'Pasajero'}
                                  </span>
                                  {item.tipo === 'pasajero' && item.pasajeroId ? (
                                    <button
                                      type="button"
                                      className="operativo-pasajero-link"
                                      onClick={() =>
                                        setFichaPasajero({
                                          id: item.pasajeroId!,
                                          nombre: item.pasajeroNombre,
                                        })
                                      }
                                    >
                                      {item.pasajeroNombre}
                                    </button>
                                  ) : (
                                    <strong>{item.pasajeroNombre}</strong>
                                  )}
                                  {actual && (
                                    <span className="operativo-asistencia-estado">
                                      {' '}
                                      · {labels[actual.estado]}
                                      {actual.motivoCancelacion
                                        ? ` (${actual.motivoCancelacion})`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="admin-actions">
                                  {(['ASISTIO', 'CANCELO'] as EstadoAsistencia[]).map((estado) => (
                                    <button
                                      key={estado}
                                      type="button"
                                      className={`btn btn--sm${
                                        actual?.estado === estado
                                          ? ' btn--primary'
                                          : ' btn--outline'
                                      }`}
                                      disabled={busy || Boolean(finAt) || jornadaCerrada}
                                      onClick={() =>
                                        void saveAsistencia(
                                          item.pasajeroNombre,
                                          item.pasajeroId,
                                          estado,
                                        )
                                      }
                                    >
                                      {labels[estado]}
                                    </button>
                                  ))}
                                </div>
                                {(actual?.estado === 'CANCELO' ||
                                  motivos[item.pasajeroNombre] !== undefined) && (
                                  <input
                                    className="operativo-motivo"
                                    placeholder={
                                      item.tipo === 'destino'
                                        ? 'Motivo (opcional)'
                                        : 'Motivo de cancelación (opcional)'
                                    }
                                    value={
                                      motivos[item.pasajeroNombre] ??
                                      actual?.motivoCancelacion ??
                                      ''
                                    }
                                    disabled={busy || Boolean(finAt) || jornadaCerrada}
                                    onChange={(e) =>
                                      setMotivos((prev) => ({
                                        ...prev,
                                        [item.pasajeroNombre]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      if (actual?.estado === 'CANCELO') {
                                        void saveAsistencia(
                                          item.pasajeroNombre,
                                          item.pasajeroId,
                                          'CANCELO',
                                        );
                                      }
                                    }}
                                  />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  )}

                  {selected.conCeladora && (
                    <section className="panel-card">
                      <p className="panel-card__desc">
                        Este recorrido va <strong>con celadora</strong>: la asistencia la registra{' '}
                        {selected.celadora?.username ?? 'la celadora'}.
                      </p>
                    </section>
                  )}

                  {finAt && (
                    <section className="panel-card">
                      <h2>Informe de observaciones</h2>
                      {jornadaCerrada ? (
                        <div className="operativo-jornada-ok" role="status">
                          <p className="operativo-jornada-ok__title">
                            Jornada Completada Exitosamente
                          </p>
                          <p>Gracias por tu compromiso con LC</p>
                          <p
                            className="panel-card__desc"
                            style={{ marginBottom: 0, marginTop: '0.75rem' }}
                          >
                            Esta grilla quedó cerrada: ya no se pueden modificar asistencias,
                            destinos ni el informe.
                          </p>
                          <div className="operativo-informe-resumen">
                            {selected.conCeladora && selected.informeChoferCeladora && (
                              <p>
                                <strong>Celadora:</strong> {selected.informeChoferCeladora}
                              </p>
                            )}
                            {selected.informeChoferVehiculo && (
                              <p>
                                <strong>Vehículo:</strong> {selected.informeChoferVehiculo}
                              </p>
                            )}
                            {selected.combustibleNivel && (
                              <p>
                                <strong>Combustible:</strong>{' '}
                                {NIVEL_COMBUSTIBLE_LABEL[selected.combustibleNivel]}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="panel-card__desc">
                            Completá los 3 puntos del informe. Al guardar se cierra la jornada
                            (punto de no retorno).
                          </p>

                          {selected.conCeladora && (
                            <div className="form-group">
                              <label htmlFor="inf-celadora">Sobre la celadora</label>
                              <textarea
                                id="inf-celadora"
                                className="operativo-informe"
                                rows={2}
                                value={choferForm.celadora}
                                onChange={(e) =>
                                  setChoferForm((p) => ({ ...p, celadora: e.target.value }))
                                }
                                placeholder="La celadora destaca en su trabajo realizando..."
                              />
                            </div>
                          )}

                          <div className="form-group">
                            <label htmlFor="inf-vehiculo">Sobre el vehículo</label>
                            <textarea
                              id="inf-vehiculo"
                              className="operativo-informe"
                              rows={2}
                              value={choferForm.vehiculo}
                              onChange={(e) =>
                                setChoferForm((p) => ({ ...p, vehiculo: e.target.value }))
                              }
                              placeholder="El vehículo no presenta fallas que notificar"
                            />
                          </div>

                          {!isPrestador && (
                          <div className="form-group">
                            <label htmlFor="inf-combustible">Nivel de combustible</label>
                            <select
                              id="inf-combustible"
                              className="admin-inline-select"
                              value={choferForm.combustible}
                              onChange={(e) =>
                                setChoferForm((p) => ({
                                  ...p,
                                  combustible: e.target.value as '' | NivelCombustible,
                                }))
                              }
                            >
                              <option value="">Seleccionar nivel</option>
                              {NIVELES_COMBUSTIBLE.map((n) => (
                                <option key={n.value} value={n.value}>
                                  {n.label}
                                </option>
                              ))}
                            </select>
                            <p className="panel-card__desc" style={{ marginTop: '0.35rem' }}>
                              Misma escala para todos los vehículos (vacío → lleno), para poder
                              comparar consumo a futuro.
                            </p>
                          </div>
                          )}
                          {isPrestador && (
                            <p className="panel-card__desc">
                              Prestador: no se solicita nivel de combustible (vehículo propio).
                            </p>
                          )}

                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy || !choferInformeListo}
                            onClick={() => void saveInforme()}
                          >
                            Guardar informe y cerrar jornada
                          </button>
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
        </div>
      </div>

      {fichaPasajero && selected && (
        <PasajeroContactoModal
          grillaId={selected.id}
          pasajeroId={fichaPasajero.id}
          pasajeroNombre={fichaPasajero.nombre}
          onClose={() => setFichaPasajero(null)}
        />
      )}
    </div>
  );
}
