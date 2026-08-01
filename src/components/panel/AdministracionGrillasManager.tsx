'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { readApiError } from '@/lib/api-errors';
import {
  buildGrillaTitulo,
  daysInMonth,
  fechaGrillaKey,
  formatAccionFila,
  formatFechaGrilla,
  labelDiaCorto,
  labelMesAnio,
  labelTipoItinerario,
  mondayOfWeek,
  monthStartKey,
  shiftWeekMonday,
  tipoDefaultDeGrupo,
  TIPOS_GRUPO,
  TIPO_GRUPO_COLOR,
  TIPO_GRUPO_LABEL,
  todayFechaInput,
  weekdaysMonFri,
  type AccionParada,
  type TipoGrupoItinerario,
} from '@/lib/grilla.utils';
import {
  buildGrillaWhatsAppShareText,
  downloadGrillaPdf,
  openGrillaPrintWindow,
  type GrillaPrintInput,
} from '@/lib/grilla-print';
import {
  grillaBloqueadaOperativa,
  normalizeEstadoGrilla,
  puedeEditarGrillaAdministracion,
} from '@/lib/grilla-estado';
import { GrillaEstadoChip } from '@/components/panel/GrillaEstadoChip';
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

type PeriodoVista = 'hoy' | 'semana' | 'mes';

const GRILLA_BASE_STORAGE_KEY = 'lc-administracion-grilla-base';

export function AdministracionGrillasManager({
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
  const [createFecha, setCreateFecha] = useState(todayFechaInput());

  const [periodo, setPeriodo] = useState<PeriodoVista>('hoy');
  const [tipoGrupo, setTipoGrupo] = useState<TipoGrupoItinerario>('ingreso');
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeek(todayFechaInput()));
  const now = new Date();
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [mesDiaSeleccionado, setMesDiaSeleccionado] = useState<string | null>(null);

  const hoy = todayFechaInput();
  const borderColor = TIPO_GRUPO_COLOR[tipoGrupo];

  const rangeForLoad = useMemo(() => {
    if (esHistorial) return { from: undefined as string | undefined, to: undefined as string | undefined };
    if (periodo === 'hoy') return { from: hoy, to: hoy };
    if (periodo === 'semana') {
      const days = weekdaysMonFri(weekMonday);
      return { from: days[0], to: days[4] };
    }
    const from = monthStartKey(monthYear, monthIndex);
    const last = daysInMonth(monthYear, monthIndex);
    const to = `${monthYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from, to };
  }, [esHistorial, periodo, hoy, weekMonday, monthYear, monthIndex]);

  const loadAreas = useCallback(async () => {
    const response = await fetch('/api/administracion/areas');
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
      const params = new URLSearchParams();
      if (selectedArea) params.set('areaId', selectedArea);
      if (!esHistorial) {
        if (rangeForLoad.from) params.set('from', rangeForLoad.from);
        if (rangeForLoad.to) params.set('to', rangeForLoad.to);
        params.set('tipoGrupo', tipoGrupo);
      }
      const qs = params.toString();
      const response = await fetch(`/api/administracion/grillas${qs ? `?${qs}` : ''}`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar las grillas.');
        return;
      }
      setGrillas(body.data as GrillaListItem[]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable
    [esHistorial, rangeForLoad.from, rangeForLoad.to, tipoGrupo],
  );

  const loadOptions = useCallback(
    async (selectedArea: string) => {
      if (!selectedArea) {
        setOptions(null);
        return;
      }
      const response = await fetch(`/api/administracion/grillas/options?areaId=${selectedArea}`);
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

  const grillasVisibles = useMemo(() => {
    if (esHistorial) return grillas;
    return grillas;
  }, [esHistorial, grillas]);

  const selected = useMemo(
    () => grillasVisibles.find((g) => g.id === selectedId) ?? null,
    [grillasVisibles, selectedId],
  );

  const monthCells = useMemo(() => {
    const first = monthStartKey(monthYear, monthIndex);
    const total = daysInMonth(monthYear, monthIndex);
    const firstDow = new Date(`${first}T12:00:00.000Z`).getUTCDay();
    const lead = firstDow === 0 ? 6 : firstDow - 1;
    const cells: ({ key: string; day: number } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const key = `${monthYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ key, day: d });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthYear, monthIndex]);

  const openNueva = (fecha: string) => {
    setCreateFecha(fecha);
    setBoardInitial(null);
    setBoardMode('nueva');
    setBoardKey((k) => k + 1);
  };

  const openEditar = async (grilla: GrillaListItem) => {
    const estado = normalizeEstadoGrilla(grilla.estado);

    if (grillaBloqueadaOperativa(estado)) {
      popup.error('Esta grilla está en curso o finalizada y no se puede editar.');
      return;
    }

    if (!puedeEditarGrillaAdministracion(estado)) {
      const ok = await popup.confirm({
        message:
          'Al editar, la grilla vuelve a borrador y deja de verse para chofer/celadora hasta que el Admin la apruebe de nuevo. ¿Continuar?',
        confirmLabel: 'Editar',
      });
      if (!ok) return;
      const response = await fetch(`/api/administracion/grillas/${grilla.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'volver_borrador' }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo pasar a borrador.'));
        return;
      }
      await loadGrillas(areaId);
      grilla = { ...grilla, estado: 'BORRADOR' };
    }

    setBoardInitial(grilla);
    setBoardMode('editar');
    setBoardKey((k) => k + 1);
    setSelectedId(grilla.id);
  };

  const enviarRevision = async (grilla: GrillaListItem) => {
    const response = await fetch(`/api/administracion/grillas/${grilla.id}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enviar_revision' }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo enviar a revisión.'));
      return;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Enviada a revisión.');
    await loadGrillas(areaId);
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
    setCreateFecha(hoy);
    setBoardInitial({
      id: '',
      nombre: grilla.nombre ? `${grilla.nombre} (copia)` : '',
      tipoItinerario: grilla.tipoItinerario,
      fecha: hoy,
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
      setCreateFecha(hoy);
      setBoardInitial({
        id: '',
        nombre: grilla.nombre ? `${grilla.nombre} (copia)` : '',
        tipoItinerario: grilla.tipoItinerario,
        fecha: hoy,
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
    const response = await fetch(`/api/administracion/grillas/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar la grilla.'));
      return;
    }
    popup.success('Grilla eliminada.');
    if (selectedId === id) setSelectedId(null);
    await loadGrillas(areaId);
  };

  const toPrintInput = (grilla: {
    nombre: string;
    fecha: string;
    tipoItinerario: string;
    area: { nombre: string };
    transporte: { nombre: string };
    chofer: { username: string };
    celadora: { username: string } | null;
    conCeladora: boolean;
    filas: { pasajeroNombre: string; pasajeroId?: string | null }[];
    asistencias?: {
      pasajeroNombre: string;
      estado: string;
      motivoCancelacion?: string | null;
    }[];
    cierreTipo?: string | null;
    cierreNota?: string | null;
    cerradoAt?: string | null;
    cerradoPor?: { username: string } | null;
  }): GrillaPrintInput => ({
    nombre: grilla.nombre,
    fecha: grilla.fecha,
    tipoItinerario: grilla.tipoItinerario,
    areaNombre: grilla.area.nombre,
    transporteNombre: grilla.transporte.nombre,
    choferNombre: grilla.chofer.username,
    celadoraNombre: grilla.celadora?.username ?? null,
    conCeladora: grilla.conCeladora,
    filas: grilla.filas,
    asistencias: grilla.asistencias,
    cierreTipo: grilla.cierreTipo,
    cierreNota: grilla.cierreNota,
    cerradoAt: grilla.cerradoAt,
    cerradoPorNombre: grilla.cerradoPor?.username ?? null,
  });

  const loadGrillaExport = async (id: string) => {
    const response = await fetch(`/api/administracion/grillas/${id}`);
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? 'No se pudo cargar la grilla.');
    }
    return body.data as {
      nombre: string;
      fecha: string;
      tipoItinerario: string;
      area: { nombre: string };
      transporte: { nombre: string };
      chofer: { username: string };
      celadora: { username: string } | null;
      conCeladora: boolean;
      filas: { pasajeroNombre: string; pasajeroId?: string | null }[];
      asistencias?: {
        pasajeroNombre: string;
        estado: string;
        motivoCancelacion?: string | null;
      }[];
      cierreTipo?: string | null;
      cierreNota?: string | null;
      cerradoAt?: string | null;
      cerradoPor?: { username: string } | null;
    };
  };

  const shareWhatsApp = async (grilla: GrillaListItem) => {
    try {
      const full = await loadGrillaExport(grilla.id);
      const input = toPrintInput(full);
      await downloadGrillaPdf(input);
      const text = buildGrillaWhatsAppShareText(input);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      popup.success('PDF descargado. Adjuntarlo en el chat de WhatsApp.');
    } catch (error) {
      popup.error(
        error instanceof Error ? error.message : 'No se pudo preparar el PDF para WhatsApp.',
      );
    }
  };

  const printGrilla = async (grilla: GrillaListItem) => {
    try {
      const full = await loadGrillaExport(grilla.id);
      const ok = openGrillaPrintWindow(toPrintInput(full));
      if (!ok) {
        popup.error('Permití ventanas emergentes para imprimir o guardar PDF.');
      }
    } catch (error) {
      popup.error(
        error instanceof Error ? error.message : 'No se pudo preparar la impresión.',
      );
    }
  };

  const renderAcciones = (g: GrillaListItem, compact = false) => {
    const estado = normalizeEstadoGrilla(g.estado);
    const puedeEnviar = puedeEditarGrillaAdministracion(estado);
    const bloqueada = grillaBloqueadaOperativa(estado);

    return (
      <div className="admin-actions">
        {!compact && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => setSelectedId((current) => (current === g.id ? null : g.id))}
          >
            {selectedId === g.id ? 'Ocultar' : 'Ver'}
          </button>
        )}
        {!esHistorial && !bloqueada && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void openEditar(g)}
          >
            Editar
          </button>
        )}
        {puedeEnviar && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => void enviarRevision(g)}
          >
            Enviar a revisión
          </button>
        )}
        <button type="button" className="btn btn--outline btn--sm" onClick={() => applyGrillaBase(g)}>
          Usar como base
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => void shareWhatsApp(g)}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => void printGrilla(g)}
        >
          Imprimir
        </button>
        {!bloqueada && (
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={() => void handleDelete(g.id, g.nombre)}
          >
            Eliminar
          </button>
        )}
      </div>
    );
  };

  const renderListaDetalle = (list: GrillaListItem[], emptyMsg: string) => (
    <>
      {list.length === 0 ? (
        <p className="panel-card__desc">{emptyMsg}</p>
      ) : (
        <div className="admin-users__table-wrap">
          <table className="admin-users__table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Itinerario</th>
                <th>Transporte</th>
                <th>Responsables</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.id} className={selectedId === g.id ? 'is-selected' : ''}>
                  <td>
                    <strong>{g.nombre || 'Sin nombre'}</strong>
                    {g.notaRevision && g.estado === 'OBSERVADA' ? (
                      <p className="panel-card__desc" style={{ margin: '0.25rem 0 0' }}>
                        Corregir: {g.notaRevision}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <GrillaEstadoChip estado={g.estado} />
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
                  <td>{renderAcciones(g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderPreview = () =>
    selected ? (
      <section className="panel-card grilla-preview">
        <h2>
          {selected.nombre ? `${selected.nombre} — ` : ''}
          {buildGrillaTitulo({
            tipoItinerario: selected.tipoItinerario,
            transporteNombre: selected.transporte.nombre,
            fecha: selected.fecha,
          })}{' '}
          <GrillaEstadoChip estado={selected.estado} />
        </h2>
        <p className="panel-card__desc">
          Responsables:{' '}
          {selected.conCeladora
            ? `${selected.chofer.username} + ${selected.celadora?.username ?? '—'}`
            : `${selected.chofer.username} (sin celadora)`}{' '}
          · Tipo: {selected.transporte.tipo}
        </p>
        {selected.notaRevision && selected.estado === 'OBSERVADA' ? (
          <p className="grilla-preview__nota">Corregir: {selected.notaRevision}</p>
        ) : null}
        {selected.nota && <p className="grilla-preview__nota">{selected.nota}</p>}
        {!esHistorial && (
          <div style={{ marginBottom: '0.75rem' }}>{renderAcciones(selected, true)}</div>
        )}
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
    ) : null;

  if (!esHistorial && boardMode !== 'cerrado' && options) {
    return (
      <GrillaTablero
        key={boardKey}
        areaId={areaId}
        options={options}
        defaultFecha={createFecha}
        defaultTipoItinerario={tipoDefaultDeGrupo(tipoGrupo)}
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

  /* ——— Historial (sin rediseño) ——— */
  if (esHistorial) {
    return (
      <div className="adm-grillas">
        <section className="panel-card">
          <div className="grilla-list-head">
            <div>
              <h2>Historial de grillas</h2>
              <p className="panel-card__desc">
                Listado completo del área. Podés usar una grilla como base para armar otra.
              </p>
            </div>
          </div>
          <div className="form-group" style={{ maxWidth: 320 }}>
            <label htmlFor="g-area-hist">Área</label>
            <select
              id="g-area-hist"
              value={areaId}
              onChange={(e) => {
                setSelectedId(null);
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
          {renderListaDetalle(grillasVisibles, 'Todavía no hay grillas en esta área.')}
        </section>
        {renderPreview()}
      </div>
    );
  }

  const weekDays = weekdaysMonFri(weekMonday);
  const grillasHoy = grillasVisibles.filter((g) => fechaGrillaKey(g.fecha) === hoy);
  const grillasPorDia = (fechaKey: string) =>
    grillasVisibles.filter((g) => fechaGrillaKey(g.fecha) === fechaKey);

  const shiftMonth = (delta: number) => {
    let y = monthYear;
    let m = monthIndex + delta;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonthYear(y);
    setMonthIndex(m);
    setMesDiaSeleccionado(null);
  };

  return (
    <div className="adm-grillas">
      <div className="admin-tabs-shell">
        <div className="admin-tabs" role="tablist" aria-label="Áreas">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={areaId === a.id}
              className={`admin-tabs__btn${areaId === a.id ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedId(null);
                setMesDiaSeleccionado(null);
                setAreaId(a.id);
              }}
            >
              {a.nombre}
            </button>
          ))}
        </div>
      </div>

      <section
        className="panel-card grillas-periodo"
        style={{ borderColor: borderColor, borderWidth: 2, borderStyle: 'solid' }}
      >
        <div className="grillas-periodo__toolbar">
          <nav className="panel-segment" aria-label="Periodo">
            {(
              [
                ['hoy', 'Hoy'],
                ['semana', 'Semana'],
                ['mes', 'Mes'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`panel-segment__item${periodo === id ? ' is-active' : ''}`}
                onClick={() => {
                  setPeriodo(id);
                  setSelectedId(null);
                  setMesDiaSeleccionado(null);
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="grillas-tipo-chips" role="group" aria-label="Tipo de itinerario">
            {TIPOS_GRUPO.map((g) => (
              <button
                key={g}
                type="button"
                className={`grillas-tipo-chip${tipoGrupo === g ? ' is-active' : ''}`}
                  style={
                    {
                      '--chip-color': TIPO_GRUPO_COLOR[g],
                    } as CSSProperties
                  }
                onClick={() => {
                  setTipoGrupo(g);
                  setSelectedId(null);
                }}
              >
                {TIPO_GRUPO_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        {periodo === 'hoy' && (
          <div className="grillas-periodo__body">
            <div className="grilla-list-head">
              <div>
                <h2>Hoy — {formatFechaGrilla(hoy)}</h2>
                <p className="panel-card__desc">
                  Grillas de {TIPO_GRUPO_LABEL[tipoGrupo].toLowerCase()} para el día actual.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!areaId || !options}
                onClick={() => openNueva(hoy)}
              >
                Crear
              </button>
            </div>
            {renderListaDetalle(grillasHoy, 'No hay grillas para hoy con este filtro.')}
          </div>
        )}

        {periodo === 'semana' && (
          <div className="grillas-periodo__body">
            <div className="grillas-semana__nav">
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setWeekMonday((m) => shiftWeekMonday(m, -1))}
                aria-label="Semana anterior"
              >
                ←
              </button>
              <strong>
                {formatFechaGrilla(weekDays[0])} — {formatFechaGrilla(weekDays[4])}
              </strong>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setWeekMonday((m) => shiftWeekMonday(m, 1))}
                aria-label="Semana siguiente"
              >
                →
              </button>
            </div>
            <div className="grillas-semana__row">
              {weekDays.map((dayKey) => {
                const list = grillasPorDia(dayKey);
                return (
                  <div key={dayKey} className="grillas-semana__day">
                    <header>
                      <span>{labelDiaCorto(dayKey)}</span>
                      <strong>{formatFechaGrilla(dayKey)}</strong>
                    </header>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={!areaId || !options}
                      onClick={() => openNueva(dayKey)}
                    >
                      Crear
                    </button>
                    <ul className="grillas-semana__list">
                      {list.length === 0 ? (
                        <li className="grillas-semana__empty">Sin grillas</li>
                      ) : (
                        list.map((g) => (
                          <li key={g.id}>
                            <button
                              type="button"
                              className={`grillas-semana__name${selectedId === g.id ? ' is-active' : ''}`}
                              onClick={() =>
                                setSelectedId((cur) => (cur === g.id ? null : g.id))
                              }
                            >
                              {g.nombre || 'Sin nombre'}
                            </button>
                            <div style={{ marginTop: '0.25rem' }}>
                              <GrillaEstadoChip estado={g.estado} />
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
            {selected &&
              fechaGrillaKey(selected.fecha) >= weekDays[0]! &&
              fechaGrillaKey(selected.fecha) <= weekDays[4]! && (
              <div className="grillas-semana__detail">{renderPreview()}</div>
            )}
          </div>
        )}

        {periodo === 'mes' && (
          <div className="grillas-periodo__body">
            {mesDiaSeleccionado ? (
              <>
                <div className="grilla-list-head">
                  <div>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => {
                        setMesDiaSeleccionado(null);
                        setSelectedId(null);
                      }}
                    >
                      ← Volver al mes
                    </button>
                    <h2 style={{ marginTop: '0.75rem' }}>
                      {formatFechaGrilla(mesDiaSeleccionado)}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!areaId || !options}
                    onClick={() => openNueva(mesDiaSeleccionado)}
                  >
                    Crear
                  </button>
                </div>
                {renderListaDetalle(
                  grillasPorDia(mesDiaSeleccionado),
                  'No hay grillas para este día con este filtro.',
                )}
              </>
            ) : (
              <>
                <div className="grillas-mes__nav">
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Mes anterior"
                  >
                    ←
                  </button>
                  <strong>{labelMesAnio(monthYear, monthIndex)}</strong>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => shiftMonth(1)}
                    aria-label="Mes siguiente"
                  >
                    →
                  </button>
                </div>
                <div className="grillas-mes__weekdays" aria-hidden="true">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grillas-mes__grid">
                  {monthCells.map((cell, idx) =>
                    cell ? (
                      <button
                        key={cell.key}
                        type="button"
                        className={`grillas-mes__cell${cell.key === hoy ? ' is-today' : ''}`}
                        onClick={() => {
                          setMesDiaSeleccionado(cell.key);
                          setSelectedId(null);
                        }}
                      >
                        <span className="grillas-mes__date">{cell.day}</span>
                        <span className="grillas-mes__count">
                          Grillas {grillasPorDia(cell.key).length}
                        </span>
                      </button>
                    ) : (
                      <div key={`empty-${idx}`} className="grillas-mes__cell is-empty" />
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {periodo === 'hoy' && renderPreview()}
      {periodo === 'mes' && mesDiaSeleccionado && renderPreview()}
    </div>
  );
}
