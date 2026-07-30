'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatFechaGrilla, labelTipoItinerario, todayFechaInput } from '@/lib/grilla.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type PersonaListItem = { id: string; username: string; informes: number };

type Listado = {
  rango: { desde: string; hasta: string };
  celadoras: PersonaListItem[];
  choferes: PersonaListItem[];
};

type CeladoraDetail = {
  tipo: 'celadora';
  rango: { desde: string; hasta: string };
  persona: { id: string; username: string };
  historial: {
    grillaId: string;
    fecha: string;
    tipoItinerario: string;
    area: string;
    transporte: string;
    tipoTransporte: string;
    chofer: string;
    nota: string | null;
    informe: string | null;
    duracionMinutos: number | null;
    asistencias: { asistio: number; cancelo: number; noSePresento: number };
  }[];
  porRuta: {
    transporteId: string;
    transporteNombre: string;
    promedioDuracionMinutos: number | null;
    muestrasDuracion: number;
    viajes: number;
    promedioPasajerosAsistieron: number | null;
    totalAsistio: number;
  }[];
  porDestino: { destinoId: string; nombre: string; asistio: number }[];
};

type ChoferDetail = {
  tipo: 'chofer';
  rango: { desde: string; hasta: string };
  persona: {
    id: string;
    username: string;
    vehiculo: { id: string; nombre: string; tipo: string } | null;
  };
  historial: {
    grillaId: string;
    fecha: string;
    tipoItinerario: string;
    area: string;
    transporte: string;
    tipoTransporte: string;
    celadora: string | null;
    conCeladora: boolean;
    nota: string | null;
    informe: string | null;
    informeCeladoraObs: string | null;
    informeVehiculo: string | null;
    combustibleNivel: string | null;
    duracionMinutos: number | null;
  }[];
  porRuta: {
    transporteId: string;
    transporteNombre: string;
    promedioDuracionMinutos: number | null;
    muestrasDuracion: number;
    viajes: number;
  }[];
  combustible: { nivel: string; label: string; count: number }[];
};

type Detalle = CeladoraDetail | ChoferDetail;

function daysAgoInput(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatMinutos(mins: number | null): string {
  if (mins === null || mins === undefined) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function combustibleLabel(nivel: string | null): string {
  const map: Record<string, string> = {
    VACIO: 'Vacío',
    CUARTO: '1/4',
    MEDIO: 'Medio',
    TRES_CUARTOS: '3/4',
    LLENO: 'Lleno',
  };
  return nivel ? (map[nivel] ?? nivel) : '—';
}

function BarList({
  items,
}: {
  items: { label: string; value: number; suffix?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="panel-card__desc">Sin datos en el período.</p>;
  }
  return (
    <ul className="informe-bars">
      {items.map((item, idx) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <li key={`${item.label}-${idx}`}>
            <div className="informe-bars__meta">
              <span>{item.label}</span>
              <strong>
                {item.value}
                {item.suffix ? ` ${item.suffix}` : ''}
              </strong>
            </div>
            <div className="informe-bars__track" aria-hidden="true">
              <div className="informe-bars__fill" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function InformeMetricasPanel() {
  const popup = usePanelPopup();
  const [desde, setDesde] = useState(daysAgoInput(30));
  const [hasta, setHasta] = useState(todayFechaInput());
  const [listado, setListado] = useState<Listado | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [seleccion, setSeleccion] = useState<{
    tipo: 'celadora' | 'chofer';
    userId: string;
  } | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadListado = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ desde, hasta });
      const response = await fetch(`/api/informe/metricas?${params}`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudo cargar el listado.');
        return;
      }
      setListado(body.data as Listado);
    } catch {
      popup.error('Error de conexión al cargar el informe.');
    } finally {
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const loadDetalle = useCallback(
    async (tipo: 'celadora' | 'chofer', userId: string) => {
      setLoadingDetail(true);
      try {
        const params = new URLSearchParams({ desde, hasta, tipo, userId });
        const response = await fetch(`/api/informe/metricas?${params}`);
        const body = await response.json();
        if (!response.ok) {
          popup.error(body.message ?? 'No se pudo cargar el detalle.');
          return;
        }
        setDetalle(body.data as Detalle);
      } catch {
        popup.error('Error de conexión al cargar el detalle.');
      } finally {
        setLoadingDetail(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desde, hasta],
  );

  useEffect(() => {
    void loadListado();
  }, [loadListado]);

  useEffect(() => {
    if (!seleccion) {
      setDetalle(null);
      return;
    }
    void loadDetalle(seleccion.tipo, seleccion.userId);
  }, [seleccion, loadDetalle]);

  const selectPersona = (tipo: 'celadora' | 'chofer', userId: string) => {
    setSeleccion({ tipo, userId });
  };

  return (
    <div className="informe-metricas">
      {popup.popupNode}

      <section className="panel-card">
        <h2>Informe</h2>
        <p className="panel-card__desc">
          Historial y métricas de celadoras y choferes. Filtrá por fechas y elegí una persona.
        </p>
        <div className="informe-filtros">
          <div className="form-group">
            <label htmlFor="m-desde">Desde</label>
            <input
              id="m-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="m-hasta">Hasta</label>
            <input
              id="m-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="form-group informe-filtros__action">
            <label>&nbsp;</label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void loadListado();
                if (seleccion) void loadDetalle(seleccion.tipo, seleccion.userId);
              }}
            >
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {loadingList && !listado ? (
        <p className="panel-card__desc">Cargando...</p>
      ) : listado ? (
        <div className="informe-personas-grid">
          <section className="panel-card">
            <h2>Celadoras</h2>
            {listado.celadoras.length === 0 ? (
              <p className="panel-card__desc">No hay celadoras activas.</p>
            ) : (
              <ul className="informe-persona-list">
                {listado.celadoras.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`informe-persona-btn${
                        seleccion?.tipo === 'celadora' && seleccion.userId === c.id
                          ? ' is-active'
                          : ''
                      }`}
                      onClick={() => selectPersona('celadora', c.id)}
                    >
                      <strong>{c.username}</strong>
                      <span>
                        {c.informes} informe{c.informes === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel-card">
            <h2>Choferes</h2>
            {listado.choferes.length === 0 ? (
              <p className="panel-card__desc">No hay choferes activos.</p>
            ) : (
              <ul className="informe-persona-list">
                {listado.choferes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`informe-persona-btn${
                        seleccion?.tipo === 'chofer' && seleccion.userId === c.id
                          ? ' is-active'
                          : ''
                      }`}
                      onClick={() => selectPersona('chofer', c.id)}
                    >
                      <strong>{c.username}</strong>
                      <span>
                        {c.informes} informe{c.informes === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {!seleccion ? (
        <section className="panel-card">
          <p className="panel-card__desc">
            Seleccioná una celadora o un chofer para ver su historial y gráficas.
          </p>
        </section>
      ) : loadingDetail && !detalle ? (
        <p className="panel-card__desc">Cargando detalle...</p>
      ) : detalle?.tipo === 'celadora' ? (
        <CeladoraDetalleView detalle={detalle} />
      ) : detalle?.tipo === 'chofer' ? (
        <ChoferDetalleView detalle={detalle} />
      ) : null}
    </div>
  );
}

function CeladoraDetalleView({ detalle }: { detalle: CeladoraDetail }) {
  return (
    <>
      <section className="panel-card">
        <h2>Celadora: {detalle.persona.username}</h2>
        <p className="panel-card__desc">
          Período {detalle.rango.desde} → {detalle.rango.hasta} · {detalle.historial.length}{' '}
          informe(s)
        </p>
      </section>

      <div className="informe-columns">
        <section className="panel-card">
          <h2>Duración y asistencia por ruta</h2>
          {detalle.porRuta.length === 0 ? (
            <p className="panel-card__desc">Sin recorridos con reloj en el período.</p>
          ) : (
            <ul className="informe-ruta-list">
              {detalle.porRuta.map((r) => (
                <li key={r.transporteId}>
                  <strong>{r.transporteNombre}</strong>
                  <span>
                    Promedio: {formatMinutos(r.promedioDuracionMinutos)} ·{' '}
                    {r.promedioPasajerosAsistieron ?? 0} pasajeros/viaje · {r.viajes} viaje(s)
                  </span>
                  <div className="informe-bars__track" aria-hidden="true">
                    <div
                      className="informe-bars__fill"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((r.promedioDuracionMinutos ?? 0) / 180) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <BarList
            items={detalle.porRuta.map((r) => ({
              label: `${r.transporteNombre} (asistieron)`,
              value: r.totalAsistio,
            }))}
          />
        </section>

        <section className="panel-card">
          <h2>Asistencias por destino</h2>
          <BarList
            items={detalle.porDestino.map((d) => ({
              label: d.nombre,
              value: d.asistio,
            }))}
          />
        </section>
      </div>

      <section className="panel-card">
        <h2>Historial de informes</h2>
        {detalle.historial.length === 0 ? (
          <p className="panel-card__desc">No hay informes en este período.</p>
        ) : (
          <ul className="informe-historial">
            {detalle.historial.map((h) => (
              <li key={h.grillaId}>
                <div className="informe-historial__head">
                  <strong>
                    {formatFechaGrilla(h.fecha)} ·{' '}
                    {labelTipoItinerario(h.tipoItinerario)} · {h.transporte}
                  </strong>
                  <span>
                    {h.area} · Chofer {h.chofer} · {formatMinutos(h.duracionMinutos)}
                  </span>
                </div>
                <p className="informe-historial__stats">
                  Asistió {h.asistencias.asistio} · Canceló {h.asistencias.cancelo} · No se
                  presentó {h.asistencias.noSePresento}
                </p>
                {h.nota && <p className="informe-historial__nota">Nota grilla: {h.nota}</p>}
                <blockquote>{h.informe}</blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ChoferDetalleView({ detalle }: { detalle: ChoferDetail }) {
  return (
    <>
      <section className="panel-card">
        <h2>Chofer: {detalle.persona.username}</h2>
        <p className="panel-card__desc">
          Período {detalle.rango.desde} → {detalle.rango.hasta} · {detalle.historial.length}{' '}
          informe(s)
          {detalle.persona.vehiculo
            ? ` · Vehículo asignado: ${detalle.persona.vehiculo.nombre}`
            : ''}
        </p>
      </section>

      <div className="informe-columns">
        <section className="panel-card">
          <h2>Duración promedio por ruta</h2>
          <BarList
            items={detalle.porRuta.map((r) => ({
              label: r.transporteNombre,
              value: r.promedioDuracionMinutos ?? 0,
              suffix: 'min',
            }))}
          />
          {detalle.porRuta.length > 0 && (
            <ul className="informe-ruta-list" style={{ marginTop: '0.75rem' }}>
              {detalle.porRuta.map((r) => (
                <li key={r.transporteId}>
                  <strong>{r.transporteNombre}</strong>
                  <span>
                    {formatMinutos(r.promedioDuracionMinutos)} en promedio · {r.viajes} viaje(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-card">
          <h2>Combustible reportado</h2>
          <BarList
            items={detalle.combustible.map((c) => ({
              label: c.label,
              value: c.count,
            }))}
          />
        </section>
      </div>

      <section className="panel-card">
        <h2>Historial de informes</h2>
        {detalle.historial.length === 0 ? (
          <p className="panel-card__desc">No hay informes en este período.</p>
        ) : (
          <ul className="informe-historial">
            {detalle.historial.map((h) => (
              <li key={h.grillaId}>
                <div className="informe-historial__head">
                  <strong>
                    {formatFechaGrilla(h.fecha)} ·{' '}
                    {labelTipoItinerario(h.tipoItinerario)} · {h.transporte}
                  </strong>
                  <span>
                    {h.area} ·{' '}
                    {h.conCeladora
                      ? `Celadora ${h.celadora ?? '—'}`
                      : 'Sin celadora'}{' '}
                    · {formatMinutos(h.duracionMinutos)} · Combustible{' '}
                    {combustibleLabel(h.combustibleNivel)}
                  </span>
                </div>
                {h.nota && <p className="informe-historial__nota">Nota grilla: {h.nota}</p>}
                {h.informeCeladoraObs && (
                  <p>
                    <em>Celadora:</em> {h.informeCeladoraObs}
                  </p>
                )}
                {h.informeVehiculo && (
                  <p>
                    <em>Vehículo:</em> {h.informeVehiculo}
                  </p>
                )}
                {h.informe && <blockquote>{h.informe}</blockquote>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
