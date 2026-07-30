'use client';
import { useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
/** Colores estables por destino (asignación visual pasajero ↔ destino). */
const DESTINO_PALETTE = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0f766e',
  '#b45309',
];
type AreaSummary = {
  id: string;
  nombre: string;
  active: boolean;
  _count: {
    destinos: number;
    celadoras: number;
    transportes: number;
    pasajeros: number;
  };
};
type Destino = {
  id: string;
  nombre: string;
  domicilio: string;
  active: boolean;
};
type OptionUser = { id: string; username: string; active?: boolean };
type OptionTransporte = { id: string; nombre: string; tipo: string };
type OptionPasajero = { id: string; nombre: string; direccion: string };
type AreaDetail = {
  id: string;
  nombre: string;
  active: boolean;
  destinos: Destino[];
  celadoras: { user: OptionUser & { active: boolean; roles: string[] } }[];
  transportes: {
    transporte: OptionTransporte & {
      celadoras: { user: OptionUser & { active: boolean } }[];
      choferes: (OptionUser & { active?: boolean })[];
    };
  }[];
  pasajeros: {
    pasajero: OptionPasajero & { active: boolean };
    destinoIds: string[];
    destinos: { id: string; nombre: string; domicilio: string; active: boolean }[];
  }[];
};
export function CoordinadoraDashboard() {
  const popup = usePanelPopup();
  const [areas, setAreas] = useState<AreaSummary[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [detail, setDetail] = useState<AreaDetail | null>(null);
  const [options, setOptions] = useState<{
    celadoras: OptionUser[];
    transportes: OptionTransporte[];
    pasajeros: OptionPasajero[];
  }>({ celadoras: [], transportes: [], pasajeros: [] });
  const [loading, setLoading] = useState(true);
  const [pickCeladora, setPickCeladora] = useState('');
  const [pickTransporte, setPickTransporte] = useState('');
  const [pickPasajero, setPickPasajero] = useState('');
  const [selectedDestinoId, setSelectedDestinoId] = useState<string | null>(null);
  const [openAssign, setOpenAssign] = useState({
    celadoras: true,
    transportes: true,
  });
  const toggleAssign = (key: keyof typeof openAssign) => {
    setOpenAssign((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const loadAreas = useCallback(async () => {
    const response = await fetch('/api/coord/areas');
    const body = await response.json();
    if (!response.ok) {
      popup.error(body.message ?? 'No se pudieron cargar las áreas.');
      return [] as AreaSummary[];
    }
    const list = body.data as AreaSummary[];
    setAreas(list);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
  }, []);
  const loadDetail = useCallback(async (areaId: string) => {
    if (!areaId) {
      setDetail(null);
      return;
    }
    const response = await fetch(`/api/coord/areas/${areaId}`);
    const body = await response.json();
    if (!response.ok) {
      popup.error(body.message ?? 'No se pudo cargar el área.');
      return;
    }
    setDetail(body.data.area as AreaDetail);
    setOptions(body.data.options);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable en uso
  }, []);
  useEffect(() => {
    void (async () => {
      setLoading(true);
      const list = await loadAreas();
      setSelectedAreaId((current) => current || list[0]?.id || '');
      setLoading(false);
    })();
  }, [loadAreas]);
  useEffect(() => {
    if (selectedAreaId) {
      setSelectedDestinoId(null);
      void loadDetail(selectedAreaId);
    }
  }, [selectedAreaId, loadDetail]);
  const refresh = async () => {
    await loadAreas();
    if (selectedAreaId) await loadDetail(selectedAreaId);
  };
  const assign = async (payload: Record<string, string | null>) => {
    if (!selectedAreaId) {
      popup.error('Seleccioná un área primero.');
      return;
    }
    const response = await fetch('/api/coord/asignaciones', {
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
  };
  const assignedCeladoraIds = new Set(detail?.celadoras.map((c) => c.user.id) ?? []);
  const assignedTransporteIds = new Set(detail?.transportes.map((t) => t.transporte.id) ?? []);
  const assignedPasajeroIds = new Set(detail?.pasajeros.map((p) => p.pasajero.id) ?? []);
  const destinosAsignables =
    detail?.destinos.filter(
      (d) => d.active && !/^base\s*lc$/i.test(d.nombre.trim()),
    ) ?? [];
  const destinoColorById = new Map(
    destinosAsignables.map((d, index) => [d.id, DESTINO_PALETTE[index % DESTINO_PALETTE.length]]),
  );
  const countPasajerosPorDestino = (destinoId: string) =>
    detail?.pasajeros.filter((p) => p.destinoIds.includes(destinoId)).length ?? 0;
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
  const unavailableCeladoras =
    detail?.celadoras.filter((c) => !c.user.active).map((c) => c.user.username) ?? [];
  const unavailablePasajeros =
    detail?.pasajeros.filter((p) => !p.pasajero.active).map((p) => p.pasajero.nombre) ?? [];
  const unavailableTransporteCeladoras =
    detail?.transportes.flatMap((t) =>
      t.transporte.celadoras
        .filter((c) => !c.user.active)
        .map((c) => c.user.username),
    ) ?? [];
  const hasUnavailableAssignments =
    unavailableCeladoras.length > 0 ||
    unavailablePasajeros.length > 0 ||
    unavailableTransporteCeladoras.length > 0;
  if (loading) {
    return (
      <>
        {popup.popupNode}
        <p className="panel-card__desc">Cargando panel...</p>
      </>
    );
  }
  return (
    <div className="coord-dashboard">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Elegí el área</h2>
        <p className="panel-card__desc">
          Las áreas y destinos los carga Admin. Acá seleccionás el área para asignar recursos y
          armar grillas.
        </p>
      </section>

      <div className="admin-tabs-shell">
        <div className="admin-tabs" role="tablist" aria-label="Áreas">
          {areas.map((area) => (
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
        <div className="admin-tabs__panel">
          {!detail ? (
            <p className="panel-card__desc" style={{ margin: 0 }}>
              {areas.length === 0
                ? 'Todavía no hay áreas. Pedile a Admin que las cree.'
                : 'Seleccioná un área para ver destinos y asignaciones.'}
            </p>
          ) : (
            <div className="coord-area-detail">
          <section className="panel-card panel-card--nested">
            <h2>Destinos — {detail.nombre}</h2>
            <p className="panel-card__desc">
              Solo lectura. Los destinos los gestiona Admin.
            </p>
            {detail.destinos.length === 0 ? (
              <p className="panel-card__desc">Sin destinos todavía. Pedile a Admin que los cargue.</p>
            ) : (
              <div className="admin-users__table-wrap">
                <table className="admin-users__table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Domicilio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.destinos.map((destino) => (
                      <tr key={destino.id}>
                        <td>{destino.nombre}</td>
                        <td>{destino.domicilio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel-card">
            <h2>Asignaciones — {detail.nombre}</h2>
            <p className="panel-card__desc">
              Primero asigná celadoras y transportes al área. Después vinculá pasajeros a cada
              destino con las dos columnas de abajo.
            </p>



            {hasUnavailableAssignments && (
              <div className="coord-unavailable-banner" role="status">
                <span className="coord-unavailable-banner__icon" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Hay asignaciones no disponibles por disposición del Admin.</strong>
                  <p>
                    Siguen en el área, pero no se pueden usar en grillas nuevas hasta que el Admin
                    los reactive.
                    {unavailableCeladoras.length > 0 && (
                      <>
                        {' '}
                        Celadoras: {unavailableCeladoras.join(', ')}.
                      </>
                    )}
                    {unavailablePasajeros.length > 0 && (
                      <>
                        {' '}
                        Pasajeros: {unavailablePasajeros.join(', ')}.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}



            <div className="coord-assign-grid coord-assign-grid--2">
              <div className="coord-assign-block">
                <button
                  type="button"
                  className="coord-assign-toggle"
                  aria-expanded={openAssign.celadoras}
                  onClick={() => toggleAssign('celadoras')}
                >
                  <span className="coord-assign-toggle__title">
                    <span aria-hidden="true">{openAssign.celadoras ? '▼' : '▶'}</span>
                    Celadoras
                  </span>
                  <span className="coord-assign-count">{detail.celadoras.length}</span>
                </button>
                {openAssign.celadoras && (
                  <div className="coord-assign-body">
                    <div className="coord-assign-row">
                      <select
                        value={pickCeladora}
                        onChange={(e) => setPickCeladora(e.target.value)}
                        className="admin-inline-select"
                      >
                        <option value="">Elegir celadora</option>
                        {options.celadoras
                          .filter((c) => !assignedCeladoraIds.has(c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.username}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={!pickCeladora}
                        onClick={() => {
                          void assign({ action: 'add_celadora', userId: pickCeladora }).then(() =>
                            setPickCeladora(''),
                          );
                        }}
                      >
                        Asignar
                      </button>
                    </div>
                    <ul className="coord-chip-list coord-chip-list--scroll">
                      {detail.celadoras.length === 0 ? (
                        <li className="coord-assign-empty">Sin celadoras asignadas.</li>
                      ) : (
                        detail.celadoras.map(({ user }) => (
                          <li
                            key={user.id}
                            className={`coord-chip${user.active ? '' : ' coord-chip--unavailable'}`}
                          >
                            <span>
                              {user.username}
                              {!user.active && (
                                <small className="coord-chip__unavailable-note">
                                  {' '}
                                  — No disponible (Admin)
                                </small>
                              )}
                            </span>
                            <button
                              type="button"
                              className="coord-chip__remove"
                              onClick={() =>
                                void assign({ action: 'remove_celadora', userId: user.id })
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>



              <div className="coord-assign-block">
                <button
                  type="button"
                  className="coord-assign-toggle"
                  aria-expanded={openAssign.transportes}
                  onClick={() => toggleAssign('transportes')}
                >
                  <span className="coord-assign-toggle__title">
                    <span aria-hidden="true">{openAssign.transportes ? '▼' : '▶'}</span>
                    Transportes
                  </span>
                  <span className="coord-assign-count">{detail.transportes.length}</span>
                </button>
                {openAssign.transportes && (
                  <div className="coord-assign-body">
                    <div className="coord-assign-row">
                      <select
                        value={pickTransporte}
                        onChange={(e) => setPickTransporte(e.target.value)}
                        className="admin-inline-select"
                      >
                        <option value="">Elegir transporte</option>
                        {options.transportes
                          .filter((t) => !assignedTransporteIds.has(t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nombre} ({t.tipo})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={!pickTransporte}
                        onClick={() => {
                          void assign({
                            action: 'add_transporte',
                            transporteId: pickTransporte,
                          }).then(() => setPickTransporte(''));
                        }}
                      >
                        Asignar
                      </button>
                    </div>
                    <ul className="coord-chip-list coord-chip-list--scroll">
                      {detail.transportes.length === 0 ? (
                        <li className="coord-assign-empty">Sin transportes asignados.</li>
                      ) : (
                        detail.transportes.map(({ transporte }) => (
                          <li key={transporte.id} className="coord-chip coord-chip--block">
                            <div className="coord-chip__main">
                              <strong>
                                {transporte.nombre} ({transporte.tipo})
                              </strong>
                              <button
                                type="button"
                                className="coord-chip__remove"
                                onClick={() =>
                                  void assign({
                                    action: 'remove_transporte',
                                    transporteId: transporte.id,
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                            <div className="coord-assign-row">
                              <select
                                className="admin-inline-select"
                                defaultValue=""
                                onChange={(e) => {
                                  const userId = e.target.value;
                                  if (!userId) return;
                                  void assign({
                                    action: 'set_transporte_celadora',
                                    transporteId: transporte.id,
                                    userId,
                                  });
                                  e.target.value = '';
                                }}
                              >
                                <option value="">Asignar celadora al transporte</option>
                                {detail.celadoras
                                  .filter(
                                    (c) =>
                                      c.user.active &&
                                      !transporte.celadoras.some(
                                        (tc) => tc.user.id === c.user.id,
                                      ),
                                  )
                                  .map(({ user }) => (
                                    <option key={user.id} value={user.id}>
                                      {user.username}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            {transporte.celadoras.length > 0 && (
                              <ul className="coord-chip-list">
                                {transporte.celadoras.map(({ user }) => (
                                  <li
                                    key={user.id}
                                    className={`coord-chip${user.active ? '' : ' coord-chip--unavailable'}`}
                                  >
                                    <span>
                                      {user.username}
                                      {!user.active && (
                                        <small className="coord-chip__unavailable-note">
                                          {' '}
                                          — No disponible (Admin)
                                        </small>
                                      )}
                                    </span>
                                    <button
                                      type="button"
                                      className="coord-chip__remove"
                                      onClick={() =>
                                        void assign({
                                          action: 'clear_transporte_celadora',
                                          transporteId: transporte.id,
                                          userId: user.id,
                                        })
                                      }
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>



            <div className="coord-pasajero-matrix">
              <h3 className="coord-pasajero-matrix__title">Pasajeros por destino</h3>
              <p className="panel-card__desc">
                Seleccioná un destino a la derecha y después tocá pasajeros a la izquierda para
                asignarlos. El color del pasajero coincide con el de su destino. Tocá de nuevo al
                mismo destino para quitar la asignación.
              </p>



              <div className="coord-assign-row coord-pasajero-matrix__add">
                <select
                  value={pickPasajero}
                  onChange={(e) => setPickPasajero(e.target.value)}
                  className="admin-inline-select"
                >
                  <option value="">Agregar pasajero al área</option>
                  {options.pasajeros
                    .filter((p) => !assignedPasajeroIds.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!pickPasajero}
                  onClick={() => {
                    void assign({ action: 'add_pasajero', pasajeroId: pickPasajero }).then(() =>
                      setPickPasajero(''),
                    );
                  }}
                >
                  Agregar
                </button>
              </div>



              <div className="coord-pasajero-matrix__cols">
                <div className="coord-pasajero-matrix__col">
                  <h4 className="coord-pasajero-matrix__col-title">
                    Pasajeros
                    {!selectedDestinoId && (
                      <span className="coord-pasajero-matrix__hint"> · elegí un destino →</span>
                    )}
                  </h4>
                  <ul className="coord-pasajero-matrix__list">
                    {detail.pasajeros.length === 0 ? (
                      <li className="coord-assign-empty">Sin pasajeros en el área.</li>
                    ) : (
                      detail.pasajeros.map(({ pasajero, destinoIds, destinos }) => {
                        const isLinkedToSelected =
                          !!selectedDestinoId && destinoIds.includes(selectedDestinoId);
                        const primaryColor = destinoIds
                          .map((id) => destinoColorById.get(id))
                          .find(Boolean);
                        const destinosLabel =
                          destinos.length > 0
                            ? destinos.map((d) => d.nombre).join(' · ')
                            : 'Sin destino';
                        return (
                          <li key={pasajero.id}>
                            <div
                              className={`coord-pasajero-chip${pasajero.active ? '' : ' is-unavailable'}${isLinkedToSelected ? ' is-linked' : ''}${destinoIds.length === 0 ? ' is-unassigned' : ''}`}
                              style={
                                primaryColor
                                  ? {
                                      backgroundColor: `${primaryColor}22`,
                                      borderColor: primaryColor,
                                    }
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className="coord-pasajero-chip__main"
                                disabled={!pasajero.active}
                                onClick={() => togglePasajeroDestino(pasajero.id)}
                              >
                                <span className="coord-pasajero-chip__swatches">
                                  {destinoIds.length === 0 ? (
                                    <span className="coord-pasajero-chip__swatch" />
                                  ) : (
                                    destinoIds.map((id) => (
                                      <span
                                        key={id}
                                        className="coord-pasajero-chip__swatch"
                                        style={{
                                          background: destinoColorById.get(id) ?? '#cbd5e1',
                                        }}
                                      />
                                    ))
                                  )}
                                </span>
                                <span className="coord-pasajero-chip__text">
                                  <strong>{pasajero.nombre}</strong>
                                  <small>
                                    {destinosLabel}
                                    {!pasajero.active ? ' · No disponible' : ''}
                                  </small>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="coord-chip__remove"
                                title="Quitar del área"
                                onClick={() =>
                                  void assign({
                                    action: 'remove_pasajero',
                                    pasajeroId: pasajero.id,
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>



                <div className="coord-pasajero-matrix__col">
                  <h4 className="coord-pasajero-matrix__col-title">Destinos</h4>
                  <ul className="coord-pasajero-matrix__list">
                    {destinosAsignables.length === 0 ? (
                      <li className="coord-assign-empty">
                        Creá destinos del área (BASE LC no se usa para asignar pasajeros).
                      </li>
                    ) : (
                      destinosAsignables.map((destino) => {
                        const color = destinoColorById.get(destino.id)!;
                        const active = selectedDestinoId === destino.id;
                        const count = countPasajerosPorDestino(destino.id);
                        return (
                          <li key={destino.id}>
                            <button
                              type="button"
                              className={`coord-destino-chip${active ? ' is-active' : ''}`}
                              style={{
                                backgroundColor: active ? `${color}33` : `${color}14`,
                                borderColor: color,
                              }}
                              onClick={() =>
                                setSelectedDestinoId((prev) =>
                                  prev === destino.id ? null : destino.id,
                                )
                              }
                            >
                              <span
                                className="coord-destino-chip__swatch"
                                style={{ background: color }}
                              />
                              <span className="coord-destino-chip__text">
                                <strong>{destino.nombre}</strong>
                                <small>
                                  {destino.domicilio}
                                  {count > 0 ? ` · ${count} pasajero${count === 1 ? '' : 's'}` : ''}
                                </small>
                              </span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

