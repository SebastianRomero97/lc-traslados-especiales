'use client';

import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';

/** Colores bien diferenciados (primarios) para vincular pasajero ↔ destino. */
const DESTINO_PALETTE = [
  '#dc2626', // rojo
  '#2563eb', // azul
  '#eab308', // amarillo
  '#16a34a', // verde
  '#7c3aed', // violeta
  '#ea580c', // naranja
];

const DRAG_MIME = 'application/x-lc-recurso-area';

type RecursoKind =
  | 'celadora'
  | 'chofer'
  | 'prestador'
  | 'vehiculo'
  | 'pasajero'
  | 'destino';

type AreaRef = { id: string; nombre: string };

type PoolCeladora = { id: string; username: string; areaIds: string[]; areas: AreaRef[] };
type PoolChofer = {
  id: string;
  username: string;
  isPrestador: boolean;
  transporteId: string | null;
  transporte: { id: string; nombre: string; tipo: string } | null;
  areaIds: string[];
  areas: AreaRef[];
};
type PoolVehiculo = {
  id: string;
  nombre: string;
  tipo: string;
  choferes: { id: string; username: string; isPrestador: boolean }[];
  areaIds: string[];
  areas: AreaRef[];
};
type PoolPasajero = {
  id: string;
  nombre: string;
  direccion: string;
  areaIds: string[];
  areas: AreaRef[];
};
type PoolDestino = {
  id: string;
  nombre: string;
  domicilio: string;
  areaId: string;
  area: AreaRef;
};

type RecursosPool = {
  areas: AreaRef[];
  celadoras: PoolCeladora[];
  choferes: PoolChofer[];
  prestadores: PoolChofer[];
  transportes: PoolVehiculo[];
  pasajeros: PoolPasajero[];
  destinos: PoolDestino[];
};

type AreaDetail = {
  id: string;
  nombre: string;
  destinos: { id: string; nombre: string; domicilio: string; active: boolean }[];
  celadoras: { user: { id: string; username: string; active: boolean } }[];
  choferes?: { user: { id: string; username: string; active: boolean; isPrestador: boolean } }[];
  transportes: {
    transporte: {
      id: string;
      nombre: string;
      tipo: string;
      choferes: { id: string; username: string }[];
    };
  }[];
  pasajeros: {
    pasajero: { id: string; nombre: string; direccion: string; active: boolean };
    destinoIds: string[];
  }[];
};

type AccordionKey =
  | 'celadoras'
  | 'choferes'
  | 'vehiculos'
  | 'prestadores'
  | 'pasajeros'
  | 'destinos';

function setDrag(e: DragEvent, kind: RecursoKind, id: string) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind, id }));
  e.dataTransfer.setData('text/plain', JSON.stringify({ kind, id }));
  e.dataTransfer.effectAllowed = 'copy';
}

function readDrag(e: DragEvent): { kind: RecursoKind; id: string } | null {
  const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { kind: RecursoKind; id: string };
  } catch {
    return null;
  }
}

export function AdministracionDashboard() {
  const popup = usePanelPopup();
  const [pool, setPool] = useState<RecursosPool | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [detail, setDetail] = useState<AreaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [selectedDestinoId, setSelectedDestinoId] = useState<string | null>(null);
  const [openAcc, setOpenAcc] = useState<Record<AccordionKey, boolean>>({
    celadoras: true,
    choferes: false,
    vehiculos: true,
    prestadores: false,
    pasajeros: true,
    destinos: false,
  });

  const loadPool = useCallback(async () => {
    const response = await fetch('/api/administracion/recursos');
    const body = await response.json();
    if (!response.ok) {
      popup.error(body.message ?? 'No se pudieron cargar los recursos.');
      return null;
    }
    const data = body.data as RecursosPool;
    setPool(data);
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (areaId: string) => {
    if (!areaId) {
      setDetail(null);
      return;
    }
    const response = await fetch(`/api/administracion/areas/${areaId}`);
    const body = await response.json();
    if (!response.ok) {
      popup.error(body.message ?? 'No se pudo cargar el área.');
      return;
    }
    setDetail(body.data.area as AreaDetail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await loadPool();
      setSelectedAreaId((current) => current || data?.areas[0]?.id || '');
      setLoading(false);
    })();
  }, [loadPool]);

  useEffect(() => {
    if (selectedAreaId) {
      setSelectedDestinoId(null);
      void loadDetail(selectedAreaId);
    }
  }, [selectedAreaId, loadDetail]);

  const refresh = async () => {
    await loadPool();
    if (selectedAreaId) await loadDetail(selectedAreaId);
  };

  const assign = async (payload: Record<string, string | null>) => {
    if (!selectedAreaId) {
      popup.error('Seleccioná un área primero.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/administracion/asignaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: selectedAreaId, ...payload }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo actualizar la asignación.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      popup.success(body.message ?? 'Asignación actualizada.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const areaNombre = (id: string) =>
    pool?.areas.find((a) => a.id === id)?.nombre ?? detail?.nombre ?? 'área';

  const handleDropOnArea = async (e: DragEvent) => {
    e.preventDefault();
    setDropHover(false);
    const payload = readDrag(e);
    if (!payload || !selectedAreaId || busy) return;

    if (payload.kind === 'celadora') {
      if (detail?.celadoras.some((c) => c.user.id === payload.id)) {
        popup.warning('Esa celadora ya está en el área.');
        return;
      }
      await assign({ action: 'add_celadora', userId: payload.id });
      return;
    }

    if (payload.kind === 'chofer' || payload.kind === 'prestador') {
      if (detail?.choferes?.some((c) => c.user.id === payload.id)) {
        popup.warning('Ese chofer ya está en el área.');
        return;
      }
      await assign({ action: 'add_chofer', userId: payload.id });
      return;
    }

    if (payload.kind === 'vehiculo') {
      if (detail?.transportes.some((t) => t.transporte.id === payload.id)) {
        popup.warning('Ese vehículo ya está en el área.');
        return;
      }
      await assign({ action: 'add_transporte', transporteId: payload.id });
      return;
    }

    if (payload.kind === 'pasajero') {
      if (detail?.pasajeros.some((p) => p.pasajero.id === payload.id)) {
        popup.warning('Ese pasajero ya está en el área.');
        return;
      }
      const pasajero = pool?.pasajeros.find((p) => p.id === payload.id);
      const otras = pasajero?.areas.filter((a) => a.id !== selectedAreaId) ?? [];
      if (otras.length > 0) {
        const ok = await popup.confirm({
          title: 'Pasajero en otra área',
          message: `Este pasajero está asignado en ${otras.map((a) => a.nombre).join(', ')}, ¿deseás asignarlo también en ${areaNombre(selectedAreaId)}?`,
          confirmLabel: 'Sí, asignar también',
          cancelLabel: 'Cancelar',
        });
        if (!ok) return;
      }
      await assign({ action: 'add_pasajero', pasajeroId: payload.id });
      return;
    }

    if (payload.kind === 'destino') {
      const destino = pool?.destinos.find((d) => d.id === payload.id);
      if (!destino) return;
      if (destino.areaId === selectedAreaId) {
        popup.warning('Ese destino ya pertenece a esta área.');
        return;
      }
      const ok = await popup.confirm({
        title: 'Mover destino',
        message: `El destino “${destino.nombre}” está en ${destino.area.nombre}. ¿Moverlo a ${areaNombre(selectedAreaId)}?`,
        confirmLabel: 'Mover',
        cancelLabel: 'Cancelar',
      });
      if (!ok) return;
      await assign({ action: 'set_destino_area', destinoId: payload.id });
    }
  };

  const destinosAsignables =
    detail?.destinos.filter((d) => d.active && !/^base\s*lc$/i.test(d.nombre.trim())) ?? [];
  const destinoColorById = useMemo(
    () =>
      new Map(
        destinosAsignables.map((d, index) => [
          d.id,
          DESTINO_PALETTE[index % DESTINO_PALETTE.length],
        ]),
      ),
    [destinosAsignables],
  );

  const togglePasajeroDestino = (pasajeroId: string) => {
    if (!selectedDestinoId) {
      popup.error('Primero seleccioná un destino a la derecha.');
      return;
    }
    void assign({
      action: 'set_pasajero_destino',
      pasajeroId,
      destinoId: selectedDestinoId,
    });
  };

  if (loading) {
    return (
      <>
        {popup.popupNode}
        <p className="panel-card__desc">Cargando panel...</p>
      </>
    );
  }

  const renderPoolCard = (
    key: string,
    title: string,
    subtitle: string | undefined,
    kind: RecursoKind,
    id: string,
    usedInCurrent: boolean,
    usedElsewhere?: string,
    usedStyle?: 'muted' | 'used',
  ) => (
    <div
      key={key}
      className={`adm-pool-card${usedInCurrent ? ' is-in-area' : ''}${
        usedStyle === 'used' ? ' is-used' : ''
      }`}
      draggable={!busy}
      onDragStart={(e) => setDrag(e, kind, id)}
    >
      <strong>{title}</strong>
      {subtitle && <small>{subtitle}</small>}
      {usedInCurrent && <span className="adm-pool-card__badge">En esta área</span>}
      {!usedInCurrent && usedElsewhere && (
        <span className="adm-pool-card__badge adm-pool-card__badge--other">
          {usedElsewhere}
        </span>
      )}
    </div>
  );

  return (
    <div className="adm-dashboard adm-dashboard--board">
      {popup.popupNode}

      <div className="adm-board">
        <aside className="adm-board__pool panel-card">
          <h2>Recursos</h2>
          <p className="panel-card__desc">
            Arrastrá al área activa. Celadoras, choferes y vehículos pueden estar en varias áreas.
          </p>

          {(
            [
              {
                key: 'celadoras' as const,
                label: 'Celadoras',
                count: pool?.celadoras.length ?? 0,
                body: pool?.celadoras.map((c) =>
                  renderPoolCard(
                    c.id,
                    c.username,
                    undefined,
                    'celadora',
                    c.id,
                    c.areaIds.includes(selectedAreaId),
                    c.areas.length
                      ? `En: ${c.areas.map((a) => a.nombre).join(', ')}`
                      : undefined,
                  ),
                ),
              },
              {
                key: 'choferes' as const,
                label: 'Choferes',
                count: pool?.choferes.length ?? 0,
                body: pool?.choferes.map((c) =>
                  renderPoolCard(
                    c.id,
                    c.username,
                    c.transporte ? `Vehículo: ${c.transporte.nombre}` : 'Sin vehículo',
                    'chofer',
                    c.id,
                    c.areaIds.includes(selectedAreaId),
                    c.areas.length
                      ? `En: ${c.areas.map((a) => a.nombre).join(', ')}`
                      : undefined,
                  ),
                ),
              },
              {
                key: 'vehiculos' as const,
                label: 'Vehículos',
                count: pool?.transportes.length ?? 0,
                body: pool?.transportes.map((t) =>
                  renderPoolCard(
                    t.id,
                    t.nombre,
                    `${t.tipo}${
                      t.choferes[0] ? ` · ${t.choferes.map((c) => c.username).join(', ')}` : ''
                    }`,
                    'vehiculo',
                    t.id,
                    t.areaIds.includes(selectedAreaId),
                    t.areas.length
                      ? `En: ${t.areas.map((a) => a.nombre).join(', ')}`
                      : undefined,
                  ),
                ),
              },
              {
                key: 'prestadores' as const,
                label: 'Prestadores',
                count: pool?.prestadores.length ?? 0,
                body:
                  (pool?.prestadores.length ?? 0) === 0 ? (
                    <p className="adm-assign-empty">
                      Todavía no hay prestadores. Admin los marca en Usuarios (rol Chofer +
                      Prestador).
                    </p>
                  ) : (
                    pool?.prestadores.map((c) =>
                      renderPoolCard(
                        c.id,
                        c.username,
                        c.transporte
                          ? `Vehículo propio: ${c.transporte.nombre}`
                          : 'Sin vehículo asignado',
                        'prestador',
                        c.id,
                        c.areaIds.includes(selectedAreaId),
                        c.areas.length
                          ? `En: ${c.areas.map((a) => a.nombre).join(', ')}`
                          : undefined,
                      ),
                    )
                  ),
              },
              {
                key: 'pasajeros' as const,
                label: 'Pasajeros',
                count: pool?.pasajeros.length ?? 0,
                body: pool?.pasajeros.map((p) => {
                  const inCurrent = p.areaIds.includes(selectedAreaId);
                  return renderPoolCard(
                    p.id,
                    p.nombre,
                    p.direccion,
                    'pasajero',
                    p.id,
                    inCurrent,
                    !inCurrent && p.areas.length
                      ? `En: ${p.areas.map((a) => a.nombre).join(', ')}`
                      : undefined,
                    inCurrent ? 'used' : undefined,
                  );
                }),
              },
              {
                key: 'destinos' as const,
                label: 'Destinos',
                count: pool?.destinos.length ?? 0,
                body: pool?.destinos.map((d) =>
                  renderPoolCard(
                    d.id,
                    d.nombre,
                    `${d.domicilio} · ${d.area.nombre}`,
                    'destino',
                    d.id,
                    d.areaId === selectedAreaId,
                    d.areaId !== selectedAreaId ? `Área: ${d.area.nombre}` : undefined,
                  ),
                ),
              },
            ] as const
          ).map((section) => (
            <div key={section.key} className="adm-pool-acc">
              <button
                type="button"
                className="adm-pool-acc__toggle"
                aria-expanded={openAcc[section.key]}
                onClick={() =>
                  setOpenAcc((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
                }
              >
                <span>
                  <span aria-hidden="true">{openAcc[section.key] ? '▼' : '▶'}</span>{' '}
                  {section.label}
                </span>
                <span className="adm-assign-count">{section.count}</span>
              </button>
              {openAcc[section.key] && (
                <div className="adm-pool-acc__body">{section.body}</div>
              )}
            </div>
          ))}
        </aside>

        <div className="adm-board__areas">
          <div className="admin-tabs-shell adm-area-tabs">
            <div className="admin-tabs" role="tablist" aria-label="Áreas">
              {(pool?.areas ?? []).map((area) => (
                <button
                  key={area.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedAreaId === area.id}
                  className={`admin-tabs__btn${selectedAreaId === area.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedAreaId(area.id)}
                >
                  {area.nombre}
                </button>
              ))}
            </div>

            <div
              className={`admin-tabs__panel adm-area-drop${dropHover ? ' is-drop' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropHover(true);
              }}
              onDragLeave={() => setDropHover(false)}
              onDrop={(e) => void handleDropOnArea(e)}
            >
              {!detail ? (
                <p className="panel-card__desc" style={{ margin: 0 }}>
                  {(pool?.areas.length ?? 0) === 0
                    ? 'Todavía no hay áreas. Pedile a Admin que las cree.'
                    : 'Seleccioná un área.'}
                </p>
              ) : (
                <div className="adm-area-panel">
                  <header className="adm-area-panel__head">
                    <h2>{detail.nombre}</h2>
                    <p className="panel-card__desc">
                      Soltá recursos acá para asignarlos. Usá la ✕ para quitar.
                    </p>
                  </header>

                  <section className="adm-area-section">
                    <h3>Celadoras</h3>
                    {detail.celadoras.length === 0 ? (
                      <p className="adm-assign-empty">Sin celadoras. Arrastrá desde el pool.</p>
                    ) : (
                      <ul className="adm-area-chips">
                        {detail.celadoras.map((c) => (
                          <li key={c.user.id}>
                            <span>{c.user.username}</span>
                            <button
                              type="button"
                              className="adm-chip-x"
                              aria-label={`Quitar ${c.user.username}`}
                              disabled={busy}
                              onClick={() =>
                                void assign({ action: 'remove_celadora', userId: c.user.id })
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="adm-area-section">
                    <h3>Choferes / Prestadores</h3>
                    {(detail.choferes?.length ?? 0) === 0 ? (
                      <p className="adm-assign-empty">
                        Sin choferes asignados al área (opcional; en la grilla se usa el del
                        vehículo).
                      </p>
                    ) : (
                      <ul className="adm-area-chips">
                        {detail.choferes!.map((c) => (
                          <li key={c.user.id}>
                            <span>
                              {c.user.username}
                              {c.user.isPrestador ? ' · Prestador' : ''}
                            </span>
                            <button
                              type="button"
                              className="adm-chip-x"
                              aria-label={`Quitar ${c.user.username}`}
                              disabled={busy}
                              onClick={() =>
                                void assign({ action: 'remove_chofer', userId: c.user.id })
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="adm-area-section">
                    <h3>Vehículos</h3>
                    {detail.transportes.length === 0 ? (
                      <p className="adm-assign-empty">Sin vehículos. Arrastrá desde el pool.</p>
                    ) : (
                      <ul className="adm-area-chips">
                        {detail.transportes.map((t) => (
                          <li key={t.transporte.id}>
                            <span>
                              {t.transporte.nombre} ({t.transporte.tipo})
                              {t.transporte.choferes[0]
                                ? ` · ${t.transporte.choferes.map((c) => c.username).join(', ')}`
                                : ''}
                            </span>
                            <button
                              type="button"
                              className="adm-chip-x"
                              aria-label={`Quitar ${t.transporte.nombre}`}
                              disabled={busy}
                              onClick={() =>
                                void assign({
                                  action: 'remove_transporte',
                                  transporteId: t.transporte.id,
                                })
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="adm-pasajero-matrix">
                    <h3 className="adm-pasajero-matrix__title">Destinos</h3>
                    <p className="panel-card__desc">
                      Seleccioná un destino y tocá pasajeros para vincularlos (colores). Un
                      pasajero puede tener varios destinos.
                    </p>
                    <div className="adm-pasajero-matrix__cols">
                      <div>
                        <h4>Pasajeros</h4>
                        {detail.pasajeros.length === 0 ? (
                          <p className="adm-assign-empty">Arrastrá pasajeros al área.</p>
                        ) : (
                          <ul className="adm-pasajero-destino-list">
                            {detail.pasajeros.map((p) => {
                              const colors = p.destinoIds
                                .map((id) => destinoColorById.get(id))
                                .filter(Boolean) as string[];
                              const primary = colors[0];
                              return (
                                <li key={p.pasajero.id}>
                                  <button
                                    type="button"
                                    className={`adm-pasajero-destino${
                                      !p.pasajero.active ? ' is-unavailable' : ''
                                    }`}
                                    style={
                                      primary
                                        ? {
                                            borderColor: primary,
                                            borderWidth: 2,
                                            background: `${primary}28`,
                                          }
                                        : undefined
                                    }
                                    disabled={busy || !p.pasajero.active}
                                    onClick={() => togglePasajeroDestino(p.pasajero.id)}
                                  >
                                    <span className="adm-pasajero-destino__info">
                                      <strong>{p.pasajero.nombre}</strong>
                                      {colors.length > 1 && (
                                        <span className="adm-destino-dots" aria-hidden="true">
                                          {colors.map((c) => (
                                            <i
                                              key={c}
                                              style={{ background: c }}
                                              className="adm-destino-dot"
                                            />
                                          ))}
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className="adm-chip-x"
                                    aria-label={`Quitar ${p.pasajero.nombre}`}
                                    disabled={busy}
                                    onClick={() =>
                                      void assign({
                                        action: 'remove_pasajero',
                                        pasajeroId: p.pasajero.id,
                                      })
                                    }
                                  >
                                    ×
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h4>Destinos</h4>
                        {destinosAsignables.length === 0 ? (
                          <p className="adm-assign-empty">
                            Arrastrá destinos al área (o pedile a Admin que los cree).
                          </p>
                        ) : (
                          <ul className="adm-destino-pick-list">
                            {destinosAsignables.map((d) => {
                              const color = destinoColorById.get(d.id);
                              const active = selectedDestinoId === d.id;
                              const count =
                                detail.pasajeros.filter((p) => p.destinoIds.includes(d.id))
                                  .length ?? 0;
                              return (
                                <li key={d.id}>
                                  <button
                                    type="button"
                                    className={`adm-destino-pick${active ? ' is-active' : ''}`}
                                    style={
                                      color
                                        ? {
                                            borderColor: color,
                                            borderWidth: 2,
                                            background: active
                                              ? `${color}33`
                                              : `${color}22`,
                                          }
                                        : undefined
                                    }
                                    onClick={() =>
                                      setSelectedDestinoId((cur) =>
                                        cur === d.id ? null : d.id,
                                      )
                                    }
                                  >
                                    <i
                                      className="adm-destino-dot"
                                      style={{ background: color }}
                                      aria-hidden="true"
                                    />
                                    <span>
                                      <strong>{d.nombre}</strong>
                                      <small>
                                        {d.domicilio}
                                        {count > 0 ? ` · ${count} pasajero(s)` : ''}
                                      </small>
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
