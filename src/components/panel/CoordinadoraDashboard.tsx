'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';

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

type OptionUser = { id: string; username: string };
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
      celadoras: { user: OptionUser }[];
      choferes: OptionUser[];
    };
  }[];
  pasajeros: { pasajero: OptionPasajero & { active: boolean } }[];
};

export function CoordinadoraDashboard() {
  const [areas, setAreas] = useState<AreaSummary[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [detail, setDetail] = useState<AreaDetail | null>(null);
  const [options, setOptions] = useState<{
    celadoras: OptionUser[];
    transportes: OptionTransporte[];
    pasajeros: OptionPasajero[];
  }>({ celadoras: [], transportes: [], pasajeros: [] });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const [newAreaName, setNewAreaName] = useState('');
  const [destinoForm, setDestinoForm] = useState({ nombre: '', domicilio: '' });
  const [pickCeladora, setPickCeladora] = useState('');
  const [pickTransporte, setPickTransporte] = useState('');
  const [pickPasajero, setPickPasajero] = useState('');
  const [openAssign, setOpenAssign] = useState({
    celadoras: true,
    transportes: true,
    pasajeros: false,
  });

  const toggleAssign = (key: keyof typeof openAssign) => {
    setOpenAssign((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadAreas = useCallback(async () => {
    const response = await fetch('/api/coord/areas');
    const body = await response.json();
    if (!response.ok) {
      setFeedback({ type: 'error', message: body.message ?? 'No se pudieron cargar las áreas.' });
      return [] as AreaSummary[];
    }
    const list = body.data as AreaSummary[];
    setAreas(list);
    return list;
  }, []);

  const loadDetail = useCallback(async (areaId: string) => {
    if (!areaId) {
      setDetail(null);
      return;
    }
    const response = await fetch(`/api/coord/areas/${areaId}`);
    const body = await response.json();
    if (!response.ok) {
      setFeedback({ type: 'error', message: body.message ?? 'No se pudo cargar el área.' });
      return;
    }
    setDetail(body.data.area as AreaDetail);
    setOptions(body.data.options);
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
      void loadDetail(selectedAreaId);
    }
  }, [selectedAreaId, loadDetail]);

  const refresh = async () => {
    await loadAreas();
    if (selectedAreaId) await loadDetail(selectedAreaId);
  };

  const createArea = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const missing = missingFieldsMessage(
      { nombre: newAreaName },
      { nombre: 'nombre del área' },
    );
    if (missing) {
      setFeedback({ type: 'error', message: missing });
      return;
    }

    const response = await fetch('/api/coord/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newAreaName }),
    });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo crear el área.'),
      });
      return;
    }
    const body = (await response.json()) as { message?: string; data?: { id: string } };
    setNewAreaName('');
    setFeedback({ type: 'success', message: body.message ?? 'Área creada.' });
    await loadAreas();
    if (body.data?.id) setSelectedAreaId(body.data.id);
  };

  const createDestino = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAreaId) {
      setFeedback({ type: 'error', message: 'Seleccioná un área primero.' });
      return;
    }
    setFeedback(null);

    const missing = missingFieldsMessage(
      { nombre: destinoForm.nombre, domicilio: destinoForm.domicilio },
      { nombre: 'nombre del destino', domicilio: 'domicilio' },
    );
    if (missing) {
      setFeedback({ type: 'error', message: missing });
      return;
    }

    const response = await fetch('/api/coord/destinos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: selectedAreaId, ...destinoForm }),
    });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo crear el destino.'),
      });
      return;
    }
    const body = (await response.json()) as { message?: string };
    setDestinoForm({ nombre: '', domicilio: '' });
    setFeedback({ type: 'success', message: body.message ?? 'Destino creado.' });
    await refresh();
  };

  const deleteDestino = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar destino "${nombre}"?`)) return;
    const response = await fetch(`/api/coord/destinos/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo eliminar el destino.'),
      });
      return;
    }
    const body = (await response.json()) as { message?: string };
    setFeedback({ type: 'success', message: body.message ?? 'Destino eliminado.' });
    await refresh();
  };

  const assign = async (payload: Record<string, string>) => {
    setFeedback(null);
    if (!selectedAreaId) {
      setFeedback({ type: 'error', message: 'Seleccioná un área primero.' });
      return;
    }
    const response = await fetch('/api/coord/asignaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: selectedAreaId, ...payload }),
    });
    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: await readApiError(response, 'No se pudo actualizar la asignación.'),
      });
      return;
    }
    const body = (await response.json()) as { message?: string };
    setFeedback({ type: 'success', message: body.message ?? 'Asignación actualizada.' });
    await refresh();
  };

  const assignedCeladoraIds = new Set(detail?.celadoras.map((c) => c.user.id) ?? []);
  const assignedTransporteIds = new Set(detail?.transportes.map((t) => t.transporte.id) ?? []);
  const assignedPasajeroIds = new Set(detail?.pasajeros.map((p) => p.pasajero.id) ?? []);

  if (loading) {
    return <p className="panel-card__desc">Cargando panel...</p>;
  }

  return (
    <div className="coord-dashboard">
      {feedback && (
        <p className={`form-feedback form-feedback--${feedback.type}`}>{feedback.message}</p>
      )}

      <section className="panel-card">
        <h2>Áreas</h2>
        <form className="admin-grid-form admin-grid-form--2" onSubmit={createArea}>
          <div className="form-group">
            <label htmlFor="area-nombre">Nueva área</label>
            <input
              id="area-nombre"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder="Nombre del área"
              required
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Crear área
          </button>
        </form>

        <div className="coord-area-pills">
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              className={`admin-tabs__btn${selectedAreaId === area.id ? ' is-active' : ''}`}
              onClick={() => setSelectedAreaId(area.id)}
            >
              {area.nombre}
            </button>
          ))}
        </div>
      </section>

      {detail && (
        <>
          <section className="panel-card">
            <h2>Destinos — {detail.nombre}</h2>
            <p className="panel-card__desc">Nombre y domicilio del lugar de destino.</p>
            <form className="admin-grid-form admin-grid-form--2" onSubmit={createDestino}>
              <div className="form-group">
                <label htmlFor="dest-nombre">Nombre</label>
                <input
                  id="dest-nombre"
                  value={destinoForm.nombre}
                  onChange={(e) => setDestinoForm((p) => ({ ...p, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dest-dom">Domicilio</label>
                <input
                  id="dest-dom"
                  value={destinoForm.domicilio}
                  onChange={(e) => setDestinoForm((p) => ({ ...p, domicilio: e.target.value }))}
                  placeholder="Calle, número, localidad"
                  required
                />
              </div>
              <button type="submit" className="btn btn--primary">
                Agregar destino
              </button>
            </form>

            {detail.destinos.length === 0 ? (
              <p className="panel-card__desc">Sin destinos todavía.</p>
            ) : (
              <div className="admin-users__table-wrap">
                <table className="admin-users__table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Domicilio</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.destinos.map((destino) => (
                      <tr key={destino.id}>
                        <td>{destino.nombre}</td>
                        <td>{destino.domicilio}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => void deleteDestino(destino.id, destino.nombre)}
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

          <section className="panel-card">
            <h2>Asignaciones — {detail.nombre}</h2>
            <p className="panel-card__desc">
              Tocá cada sección para expandir o plegar el listado.
            </p>

            <div className="coord-assign-grid">
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
                          <li key={user.id} className="coord-chip">
                            <span>{user.username}</span>
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
                                  <li key={user.id} className="coord-chip">
                                    <span>{user.username}</span>
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

              <div className="coord-assign-block">
                <button
                  type="button"
                  className="coord-assign-toggle"
                  aria-expanded={openAssign.pasajeros}
                  onClick={() => toggleAssign('pasajeros')}
                >
                  <span className="coord-assign-toggle__title">
                    <span aria-hidden="true">{openAssign.pasajeros ? '▼' : '▶'}</span>
                    Pasajeros
                  </span>
                  <span className="coord-assign-count">{detail.pasajeros.length}</span>
                </button>
                {openAssign.pasajeros && (
                  <div className="coord-assign-body">
                    <div className="coord-assign-row">
                      <select
                        value={pickPasajero}
                        onChange={(e) => setPickPasajero(e.target.value)}
                        className="admin-inline-select"
                      >
                        <option value="">Elegir pasajero</option>
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
                          void assign({ action: 'add_pasajero', pasajeroId: pickPasajero }).then(
                            () => setPickPasajero(''),
                          );
                        }}
                      >
                        Asignar
                      </button>
                    </div>
                    <ul className="coord-chip-list coord-chip-list--scroll">
                      {detail.pasajeros.length === 0 ? (
                        <li className="coord-assign-empty">Sin pasajeros asignados.</li>
                      ) : (
                        detail.pasajeros.map(({ pasajero }) => (
                          <li key={pasajero.id} className="coord-chip">
                            <span>
                              {pasajero.nombre}
                              <small> — {pasajero.direccion}</small>
                            </span>
                            <button
                              type="button"
                              className="coord-chip__remove"
                              onClick={() =>
                                void assign({
                                  action: 'remove_pasajero',
                                  pasajeroId: pasajero.id,
                                })
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
            </div>
          </section>
        </>
      )}
    </div>
  );
}
