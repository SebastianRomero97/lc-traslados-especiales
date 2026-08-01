'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatFechaGrilla, labelTipoItinerario, todayFechaInput } from '@/lib/grilla.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type Opcion = { id: string; nombre: string; tipo?: string };

type GrillaResumen = {
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
  choferMinutos: number | null;
  celadoraMinutos: number | null;
  asistio: number;
  cancelo: number;
};

function daysAgoInput(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function RespaldoHistorialPanel() {
  const popup = usePanelPopup();
  const [desde, setDesde] = useState(daysAgoInput(30));
  const [hasta, setHasta] = useState(todayFechaInput());
  const [areaId, setAreaId] = useState('');
  const [transporteId, setTransporteId] = useState('');
  const [pasajeroId, setPasajeroId] = useState('');
  const [areas, setAreas] = useState<Opcion[]>([]);
  const [transportes, setTransportes] = useState<Opcion[]>([]);
  const [pasajeros, setPasajeros] = useState<Opcion[]>([]);
  const [grillas, setGrillas] = useState<GrillaResumen[]>([]);
  const [filtrosResumen, setFiltrosResumen] = useState('');
  const [loading, setLoading] = useState(true);

  const queryParams = useCallback(() => {
    const params = new URLSearchParams({ desde, hasta });
    if (areaId) params.set('areaId', areaId);
    if (transporteId) params.set('transporteId', transporteId);
    if (pasajeroId) params.set('pasajeroId', pasajeroId);
    return params;
  }, [desde, hasta, areaId, transporteId, pasajeroId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/informe/respaldo?${queryParams()}`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudo cargar el respaldo.');
        return;
      }
      setAreas(body.data.opciones.areas as Opcion[]);
      setTransportes(body.data.opciones.transportes as Opcion[]);
      setPasajeros(body.data.opciones.pasajeros as Opcion[]);
      setGrillas(body.data.grillas as GrillaResumen[]);
      setFiltrosResumen(body.data.filtrosResumen as string);
    } catch {
      popup.error('Error de conexión al cargar el respaldo.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadCsv = async (formato: 'csv-grillas' | 'csv-asistencias') => {
    try {
      const params = queryParams();
      params.set('formato', formato);
      const response = await fetch(`/api/informe/respaldo?${params}`);
      if (!response.ok) {
        popup.error('No se pudo descargar el archivo.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        formato === 'csv-grillas'
          ? `lc-grillas-${desde}_${hasta}.csv`
          : `lc-asistencias-${desde}_${hasta}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      popup.success('Descarga lista. El CSV se abre con Excel.');
    } catch {
      popup.error('Error al descargar.');
    }
  };

  const printOrPdf = () => {
    const params = queryParams();
    params.set('formato', 'html');
    const win = window.open(`/api/informe/respaldo?${params}`, '_blank', 'noopener,noreferrer');
    if (!win) {
      popup.error('Permití ventanas emergentes para imprimir o guardar PDF.');
    }
  };

  return (
    <div className="respaldo-historial">
      {popup.popupNode}

      <section className="panel-card">
        <h2>Respaldo de historiales</h2>
        <p className="panel-card__desc">
          Descargá o imprimí el historial operativo (grillas, asistencias, tiempos e informes) como
          copia de seguridad. Para PDF: Imprimir → “Guardar como PDF”.
        </p>

        <div className="informe-filtros respaldo-filtros">
          <div className="form-group">
            <label htmlFor="r-desde">Desde</label>
            <input
              id="r-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="r-hasta">Hasta</label>
            <input
              id="r-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="r-area">Área</label>
            <select id="r-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Todas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="r-tr">Transporte</label>
            <select
              id="r-tr"
              value={transporteId}
              onChange={(e) => setTransporteId(e.target.value)}
            >
              <option value="">Todos</option>
              {transportes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                  {t.tipo ? ` (${t.tipo})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="r-pas">Pasajero</label>
            <select
              id="r-pas"
              value={pasajeroId}
              onChange={(e) => setPasajeroId(e.target.value)}
            >
              <option value="">Todos</option>
              {pasajeros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group informe-filtros__action">
            <label>&nbsp;</label>
            <button type="button" className="btn btn--primary" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        </div>

        <div className="respaldo-acciones">
          <button
            type="button"
            className="btn btn--outline"
            disabled={loading || grillas.length === 0}
            onClick={() => void downloadCsv('csv-grillas')}
          >
            Descargar Excel (grillas)
          </button>
          <button
            type="button"
            className="btn btn--outline"
            disabled={loading || grillas.length === 0}
            onClick={() => void downloadCsv('csv-asistencias')}
          >
            Descargar Excel (asistencias)
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading || grillas.length === 0}
            onClick={printOrPdf}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </section>

      <section className="panel-card">
        <h2>Vista previa</h2>
        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : (
          <>
            <p className="panel-card__desc">
              {filtrosResumen}. <strong>{grillas.length}</strong> grilla
              {grillas.length === 1 ? '' : 's'} (máx. 500).
            </p>
            {grillas.length === 0 ? (
              <p className="panel-card__desc">No hay datos con estos filtros.</p>
            ) : (
              <div className="admin-users__table-wrap">
                <table className="admin-users__table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nombre</th>
                      <th>Itinerario</th>
                      <th>Área</th>
                      <th>Transporte</th>
                      <th>Responsables</th>
                      <th>Asist.</th>
                      <th>Tiempos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grillas.map((g) => (
                      <tr key={g.id}>
                        <td>{formatFechaGrilla(g.fecha)}</td>
                        <td>{g.nombre}</td>
                        <td>{labelTipoItinerario(g.tipoItinerario)}</td>
                        <td>{g.area}</td>
                        <td>
                          {g.transporte}
                          <br />
                          <small>{g.tipoTransporte}</small>
                        </td>
                        <td>
                          {g.conCeladora
                            ? `${g.chofer} + ${g.celadora ?? '—'}`
                            : `${g.chofer} (sin celadora)`}
                        </td>
                        <td>
                          {g.asistio}/{g.cancelo}
                        </td>
                        <td>
                          C {g.choferMinutos ?? '—'}′ · Cel {g.celadoraMinutos ?? '—'}′
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
