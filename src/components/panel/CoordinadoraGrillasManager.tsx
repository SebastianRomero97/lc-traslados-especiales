'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import {
  buildGrillaTitulo,
  buildGrillaWhatsAppText,
  formatAccionFila,
  formatFechaGrilla,
  fechaGrillaKey,
  labelTipoItinerario,
  todayFechaInput,
  type AccionParada,
} from '@/lib/grilla.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import {
  GrillaTablero,
  type GrillaTableroInitial,
  type GrillaTableroOptions,
} from '@/components/panel/GrillaTablero';

type AreaOption = { id: string; nombre: string };

type GrillaListItem = GrillaTableroInitial & {
  area: { id: string; nombre: string };
};

const GRILLA_BASE_STORAGE_KEY = 'lc-coord-grilla-base';

export function CoordinadoraGrillasManager({
  modo = 'principal',
}: {
  modo?: 'principal' | 'historial';
}) {
  const popup = usePanelPopup();
  const esHistorial = modo === 'historial';

  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areaId, setAreaId] = useState('');
  const [grillas, setGrillas] = useState<GrillaListItem[]>([]);
  const [options, setOptions] = useState<GrillaTableroOptions | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<'cerrado' | 'nueva' | 'editar'>('cerrado');
  const [boardInitial, setBoardInitial] = useState<GrillaTableroInitial | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  const loadAreas = useCallback(async () => {
    const response = await fetch('/api/coord/areas');
    const body = await response.json();
    if (!response.ok) return;
    const list = (body.data as { id: string; nombre: string }[]).map((a) => ({
      id: a.id,
      nombre: a.nombre,
    }));
    setAreas(list);
    setAreaId((current) => current || list[0]?.id || '');
  }, []);

  const loadGrillas = useCallback(
    async (selectedArea: string) => {
      const url = selectedArea
        ? `/api/coord/grillas?areaId=${selectedArea}`
        : '/api/coord/grillas';
      const response = await fetch(url);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar las grillas.');
        return;
      }
      setGrillas(body.data as GrillaListItem[]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable
    [],
  );

  const loadOptions = useCallback(
    async (selectedArea: string) => {
      if (!selectedArea) {
        setOptions(null);
        return;
      }
      const response = await fetch(`/api/coord/grillas/options?areaId=${selectedArea}`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar opciones.');
        return;
      }
      setOptions(body.data as GrillaTableroOptions);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable
    [],
  );

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  useEffect(() => {
    if (!areaId) return;
    void loadGrillas(areaId);
    if (!esHistorial) void loadOptions(areaId);
  }, [areaId, esHistorial, loadGrillas, loadOptions]);

  const hoy = todayFechaInput();
  const grillasVisibles = useMemo(() => {
    if (esHistorial) return grillas;
    return grillas.filter((g) => fechaGrillaKey(g.fecha) === hoy);
  }, [esHistorial, grillas, hoy]);

  const selected = useMemo(
    () => grillasVisibles.find((g) => g.id === selectedId) ?? null,
    [grillasVisibles, selectedId],
  );

  const openNueva = () => {
    setBoardInitial(null);
    setBoardMode('nueva');
    setBoardKey((k) => k + 1);
  };

  const openEditar = (grilla: GrillaListItem) => {
    setBoardInitial(grilla);
    setBoardMode('editar');
    setBoardKey((k) => k + 1);
    setSelectedId(grilla.id);
  };

  const closeBoard = () => {
    setBoardMode('cerrado');
    setBoardInitial(null);
  };

  const afterSaved = async () => {
    closeBoard();
    await loadGrillas(areaId);
  };

  const afterDeleted = async () => {
    closeBoard();
    setSelectedId(null);
    await loadGrillas(areaId);
  };

  /** Desde historial: guarda base; en principal abre tablero como nueva copia. */
  const applyGrillaBase = (grilla: GrillaListItem) => {
    if (esHistorial) {
      try {
        sessionStorage.setItem(GRILLA_BASE_STORAGE_KEY, JSON.stringify(grilla));
        popup.success(
          `Base lista desde ${formatFechaGrilla(grilla.fecha)}. Abrí la pestaña Grillas para usarla.`,
        );
      } catch {
        popup.error('No se pudo guardar la base.');
      }
      return;
    }
    setBoardInitial({
      id: '',
      nombre: grilla.nombre ? `${grilla.nombre} (copia)` : '',
      tipoItinerario: grilla.tipoItinerario,
      fecha: todayFechaInput(),
      nota: grilla.nota,
      conCeladora: grilla.conCeladora,
      transporte: grilla.transporte,
      chofer: grilla.chofer,
      celadora: grilla.celadora,
      puntoEncuentro: grilla.puntoEncuentro ?? null,
      filas: grilla.filas,
    });
    setBoardMode('nueva');
    setBoardKey((k) => k + 1);
  };

  useEffect(() => {
    if (esHistorial || boardMode !== 'cerrado') return;
    try {
      const raw = sessionStorage.getItem(GRILLA_BASE_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(GRILLA_BASE_STORAGE_KEY);
      const grilla = JSON.parse(raw) as GrillaListItem;
      setBoardInitial({
        id: '',
        nombre: grilla.nombre ? `${grilla.nombre} (copia)` : '',
        tipoItinerario: grilla.tipoItinerario,
        fecha: todayFechaInput(),
        nota: grilla.nota,
        conCeladora: grilla.conCeladora,
        transporte: grilla.transporte,
        chofer: grilla.chofer,
        celadora: grilla.celadora,
        puntoEncuentro: grilla.puntoEncuentro ?? null,
        filas: grilla.filas,
      });
      setBoardMode('nueva');
      setBoardKey((k) => k + 1);
      popup.success('Base cargada desde Historial. Revisá y guardá.');
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar / modo
  }, [esHistorial]);

  const handleDelete = async (id: string, nombre?: string) => {
    const ok = await popup.confirm({
      message: `¿Eliminar la grilla "${nombre || 'sin nombre'}"?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/coord/grillas/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar la grilla.'));
      return;
    }
    popup.success('Grilla eliminada.');
    if (selectedId === id) setSelectedId(null);
    await loadGrillas(areaId);
  };

  const shareWhatsApp = (grilla: GrillaListItem) => {
    const baseTitulo = buildGrillaTitulo({
      tipoItinerario: grilla.tipoItinerario,
      transporteNombre: grilla.transporte.nombre,
      fecha: grilla.fecha,
    });
    const titulo = grilla.nombre ? `${grilla.nombre} — ${baseTitulo}` : baseTitulo;
    const text = buildGrillaWhatsAppText({
      titulo,
      tipoTransporte: grilla.transporte.tipo,
      choferNombre: grilla.chofer.username,
      celadoraNombre: grilla.celadora?.username ?? null,
      conCeladora: grilla.conCeladora,
      nota: grilla.nota,
      filas: grilla.filas,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const printGrilla = (grilla: GrillaListItem) => {
    const baseTitulo = buildGrillaTitulo({
      tipoItinerario: grilla.tipoItinerario,
      transporteNombre: grilla.transporte.nombre,
      fecha: grilla.fecha,
    });
    const titulo = grilla.nombre ? `${grilla.nombre} — ${baseTitulo}` : baseTitulo;
    const responsables = grilla.conCeladora
      ? `${grilla.chofer.username} + ${grilla.celadora?.username ?? '—'}`
      : `${grilla.chofer.username} (sin celadora)`;
    const rows = grilla.filas
      .map(
        (f) =>
          `<tr><td>${f.hora ?? '—'}</td><td>${f.direccion}</td><td>${formatAccionFila({
            accion: f.accion,
            pasajeroNombre: f.pasajeroNombre,
            trasbordoHacia: f.trasbordoHacia,
          })}</td></tr>`,
      )
      .join('');
    const html = `<!doctype html><html><head><title>${titulo}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:1.2rem} table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:0.9rem}
        th{background:#f3f4f6}
      </style></head><body>
      <h1>${titulo}</h1>
      <div><strong>Área:</strong> ${grilla.area.nombre}</div>
      <div><strong>Responsables:</strong> ${responsables}</div>
      ${grilla.nota ? `<div><strong>Nota:</strong> ${grilla.nota}</div>` : ''}
      <table><thead><tr><th>Hora</th><th>Parada</th><th>Acción</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  // Tablero activo en modo principal
  if (!esHistorial && boardMode !== 'cerrado' && options) {
    return (
      <GrillaTablero
        key={boardKey}
        areaId={areaId}
        options={options}
        initial={
          boardMode === 'editar' && boardInitial?.id
            ? boardInitial
            : boardMode === 'nueva' && boardInitial
              ? { ...boardInitial, id: '' }
              : null
        }
        onSaved={() => void afterSaved()}
        onDeleted={() => void afterDeleted()}
        onCancel={closeBoard}
      />
    );
  }

  return (
    <div className="coord-grillas">
      <section className="panel-card">
        <div className="grilla-list-head">
          <div>
            <h2>{esHistorial ? 'Historial de grillas' : 'Grillas'}</h2>
            <p className="panel-card__desc">
              {esHistorial
                ? 'Listado completo del área. Podés usar una grilla como base para armar otra.'
                : 'Grillas de hoy. Creá o abrí una para armar el recorrido arrastrando recursos.'}
            </p>
          </div>
          {!esHistorial && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!areaId || !options}
              onClick={openNueva}
            >
              Nueva grilla
            </button>
          )}
        </div>

        <div className="form-group" style={{ maxWidth: 320 }}>
          <label htmlFor="g-area-list">Área</label>
          <select
            id="g-area-list"
            value={areaId}
            onChange={(e) => {
              setSelectedId(null);
              closeBoard();
              setAreaId(e.target.value);
            }}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        {grillasVisibles.length === 0 ? (
          <p className="panel-card__desc">
            {esHistorial
              ? 'Todavía no hay grillas en esta área.'
              : 'No hay grillas para hoy. Creá una con “Nueva grilla”.'}
          </p>
        ) : (
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>Itinerario</th>
                  <th>Transporte</th>
                  <th>Responsables</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grillasVisibles.map((g) => (
                  <tr key={g.id} className={selectedId === g.id ? 'is-selected' : ''}>
                    <td>
                      <strong>{g.nombre || 'Sin nombre'}</strong>
                    </td>
                    <td>{formatFechaGrilla(g.fecha)}</td>
                    <td>{labelTipoItinerario(g.tipoItinerario)}</td>
                    <td>
                      {g.transporte.nombre}
                      <br />
                      <small>{g.transporte.tipo}</small>
                    </td>
                    <td>
                      {g.chofer.username}
                      {g.conCeladora ? ` + ${g.celadora?.username ?? '—'}` : ' (sin celadora)'}
                    </td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() =>
                          setSelectedId((current) => (current === g.id ? null : g.id))
                        }
                      >
                        {selectedId === g.id ? 'Ocultar' : 'Ver'}
                      </button>
                      {!esHistorial && (
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => openEditar(g)}
                        >
                          Abrir
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => applyGrillaBase(g)}
                      >
                        Usar como base
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => shareWhatsApp(g)}
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => printGrilla(g)}
                      >
                        Imprimir
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => void handleDelete(g.id, g.nombre)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="panel-card grilla-preview">
          <h2>
            {selected.nombre ? `${selected.nombre} — ` : ''}
            {buildGrillaTitulo({
              tipoItinerario: selected.tipoItinerario,
              transporteNombre: selected.transporte.nombre,
              fecha: selected.fecha,
            })}
          </h2>
          <p className="panel-card__desc">
            Responsables:{' '}
            {selected.conCeladora
              ? `${selected.chofer.username} + ${selected.celadora?.username ?? '—'}`
              : `${selected.chofer.username} (sin celadora)`}{' '}
            · Tipo: {selected.transporte.tipo}
          </p>
          {selected.nota && <p className="grilla-preview__nota">{selected.nota}</p>}
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
                {selected.filas.map((f) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
