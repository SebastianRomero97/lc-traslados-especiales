'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import { GrillaEstadoChip } from '@/components/panel/GrillaEstadoChip';
import { GrillaResumenPanel } from '@/components/panel/GrillaResumenPanel';
import {
  GrillaTablero,
  type GrillaTableroInitial,
  type GrillaTableroOptions,
} from '@/components/panel/GrillaTablero';
import { formatFechaGrilla, labelTipoItinerario } from '@/lib/grilla.utils';

type GrillaItem = GrillaTableroInitial & {
  area: { id: string; nombre: string };
  estado: string;
  notaRevision: string | null;
};

export function AdminGrillasRevision() {
  const popup = usePanelPopup();
  const [items, setItems] = useState<GrillaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notaDraft, setNotaDraft] = useState<Record<string, string>>({});
  const [cierreNotaDraft, setCierreNotaDraft] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<GrillaItem | null>(null);
  const [options, setOptions] = useState<GrillaTableroOptions | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/grillas');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar las grillas.');
        return;
      }
      setItems(body.data as GrillaItem[]);
    } catch {
      popup.error('Error de conexión al cargar grillas.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revisionItems = useMemo(
    () => items.filter((i) => i.estado === 'EN_REVISION' || i.estado === 'OBSERVADA'),
    [items],
  );
  const enCursoItems = useMemo(() => items.filter((i) => i.estado === 'EN_CURSO'), [items]);

  const postEstado = async (id: string, action: string, notaRevision?: string) => {
    const response = await fetch(`/api/administracion/grillas/${id}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notaRevision }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo actualizar el estado.'));
      return false;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Estado actualizado.');
    await load();
    return true;
  };

  const postCierre = async (
    id: string,
    action: 'forzar_finalizar' | 'interrumpir',
    cierreNota: string,
  ) => {
    const label =
      action === 'forzar_finalizar'
        ? 'finalizar el recorrido de forma forzada'
        : 'marcar el recorrido como interrumpido';
    const ok = await popup.confirm({
      message: `¿Confirmás ${label}? La grilla quedará finalizada y no se podrá operar.`,
      confirmLabel: action === 'forzar_finalizar' ? 'Finalizar forzado' : 'Interrumpir',
    });
    if (!ok) return;

    const response = await fetch(`/api/admin/grillas/${id}/cierre`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, cierreNota }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo cerrar la grilla.'));
      return;
    }
    const body = (await response.json()) as { message?: string };
    popup.success(body.message ?? 'Cierre registrado.');
    setCierreNotaDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await load();
  };

  const openEditar = async (item: GrillaItem) => {
    try {
      const response = await fetch(`/api/administracion/grillas/options?areaId=${item.area.id}`);
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar opciones.');
        return;
      }
      setOptions(body.data as GrillaTableroOptions);
      setEditing(item);
      setBoardKey((k) => k + 1);
    } catch {
      popup.error('Error al preparar la edición.');
    }
  };

  if (editing && options) {
    return (
      <div className="admin-section">
        {popup.popupNode}
        <section className="panel-card">
          <div className="admin-actions" style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => {
                setEditing(null);
                setOptions(null);
              }}
            >
              ← Volver a revisión
            </button>
            <GrillaEstadoChip estado={editing.estado} />
          </div>
          <p className="panel-card__desc">
            Editá la grilla y guardá. Como Admin, al guardar se aprueba automáticamente (lista para
            empezar).
          </p>
          <GrillaTablero
            key={boardKey}
            areaId={editing.area.id}
            options={options}
            initial={editing}
            aprobarDespues
            allowDelete
            onSaved={async () => {
              setEditing(null);
              setOptions(null);
              await load();
            }}
            onDeleted={async () => {
              setEditing(null);
              setOptions(null);
              await load();
            }}
            onCancel={() => {
              setEditing(null);
              setOptions(null);
            }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="admin-section">
      {popup.popupNode}

      <section className="panel-card">
        <h2>Revisión de grillas</h2>
        <p className="panel-card__desc">
          Grillas enviadas por Administración. Revisá el contenido con Ver, y después aprobá,
          devolvé con observación, o corregí vos y aprobá.
        </p>

        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : revisionItems.length === 0 ? (
          <p className="panel-card__desc">No hay grillas pendientes de revisión.</p>
        ) : (
          <ul className="transporte-fichas">
            {revisionItems.map((item) => {
              const abierta = expandedId === item.id;
              return (
                <li key={item.id} className="transporte-ficha">
                  <div className="transporte-ficha__head">
                    <div>
                      <strong>
                        {item.nombre || 'Sin nombre'}{' '}
                        <span>
                          · {formatFechaGrilla(item.fecha)} ·{' '}
                          {labelTipoItinerario(item.tipoItinerario)}
                        </span>
                      </strong>
                      <p className="panel-card__desc" style={{ margin: '0.25rem 0 0' }}>
                        {item.area.nombre} · {item.transporte.nombre} ·{' '}
                        {item.conCeladora
                          ? `${item.chofer.username} + ${item.celadora?.username ?? '—'}`
                          : `${item.chofer.username} (sin celadora)`}
                      </p>
                      <div style={{ marginTop: '0.35rem' }}>
                        <GrillaEstadoChip estado={item.estado} />
                      </div>
                      {item.notaRevision ? (
                        <p className="panel-card__desc" style={{ marginTop: '0.45rem' }}>
                          Nota de revisión: {item.notaRevision}
                        </p>
                      ) : null}
                    </div>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => setExpandedId(abierta ? null : item.id)}
                        aria-expanded={abierta}
                      >
                        {abierta ? 'Ocultar' : 'Ver'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => void postEstado(item.id, 'aprobar')}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => void openEditar(item)}
                      >
                        Editar y aprobar
                      </button>
                    </div>
                  </div>

                  {abierta ? (
                    <div className="transporte-ficha__body">
                      <GrillaResumenPanel grilla={item} />
                    </div>
                  ) : null}

                  <div className="transporte-ficha__body">
                    <div className="transporte-ficha__detalle-form">
                      <textarea
                        rows={2}
                        placeholder="Nota de corrección para Administración (obligatoria al devolver)"
                        value={notaDraft[item.id] ?? item.notaRevision ?? ''}
                        onChange={(e) =>
                          setNotaDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() =>
                          void postEstado(
                            item.id,
                            'observar',
                            notaDraft[item.id] ?? item.notaRevision ?? '',
                          )
                        }
                      >
                        Devolver / Observar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel-card" style={{ marginTop: '1.25rem' }}>
        <h2>Grillas en curso — cierre de emergencia</h2>
        <p className="panel-card__desc">
          Solo Admin. Usá estas opciones ante falla de vehículo, siniestro u otra causa que impida
          continuar. La observación es obligatoria y queda en el historial / impresión.
        </p>

        {loading ? (
          <p className="panel-card__desc">Cargando...</p>
        ) : enCursoItems.length === 0 ? (
          <p className="panel-card__desc">No hay grillas iniciadas en este momento.</p>
        ) : (
          <ul className="transporte-fichas">
            {enCursoItems.map((item) => {
              const abierta = expandedId === item.id;
              return (
                <li key={item.id} className="transporte-ficha">
                  <div className="transporte-ficha__head">
                    <div>
                      <strong>
                        {item.nombre || 'Sin nombre'}{' '}
                        <span>
                          · {formatFechaGrilla(item.fecha)} ·{' '}
                          {labelTipoItinerario(item.tipoItinerario)}
                        </span>
                      </strong>
                      <p className="panel-card__desc" style={{ margin: '0.25rem 0 0' }}>
                        {item.area.nombre} · {item.transporte.nombre} ·{' '}
                        {item.conCeladora
                          ? `${item.chofer.username} + ${item.celadora?.username ?? '—'}`
                          : `${item.chofer.username} (sin celadora)`}
                      </p>
                      <div style={{ marginTop: '0.35rem' }}>
                        <GrillaEstadoChip estado={item.estado} />
                      </div>
                    </div>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => setExpandedId(abierta ? null : item.id)}
                        aria-expanded={abierta}
                      >
                        {abierta ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </div>
                  {abierta ? (
                    <div className="transporte-ficha__body">
                      <GrillaResumenPanel grilla={item} />
                    </div>
                  ) : null}
                  <div className="transporte-ficha__body">
                    <div className="transporte-ficha__detalle-form">
                      <textarea
                        rows={3}
                        placeholder="Observación obligatoria (falla, siniestro, motivo del cierre…)"
                        value={cierreNotaDraft[item.id] ?? ''}
                        onChange={(e) =>
                          setCierreNotaDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() =>
                            void postCierre(
                              item.id,
                              'forzar_finalizar',
                              cierreNotaDraft[item.id] ?? '',
                            )
                          }
                        >
                          Finalizar recorrido forzado
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() =>
                            void postCierre(item.id, 'interrumpir', cierreNotaDraft[item.id] ?? '')
                          }
                        >
                          Recorrido interrumpido
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
