'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { missingFieldsMessage, readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type Destino = {
  id: string;
  nombre: string;
  domicilio: string;
  active: boolean;
};

type Area = {
  id: string;
  nombre: string;
  active: boolean;
  destinos: Destino[];
  _count: {
    destinos: number;
    celadoras: number;
    transportes: number;
    pasajeros: number;
  };
};

export function AdminAreasManager() {
  const popup = usePanelPopup();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [newAreaName, setNewAreaName] = useState('');
  const [destinoForm, setDestinoForm] = useState({ nombre: '', domicilio: '' });
  const [editingDestinoId, setEditingDestinoId] = useState<string | null>(null);
  const [editingDestino, setEditingDestino] = useState({ nombre: '', domicilio: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/areas');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudieron cargar las áreas.');
        return;
      }
      const list = body.data as Area[];
      setAreas(list);
      setSelectedAreaId((current) => current || list[0]?.id || '');
    } catch {
      popup.error('Error de conexión al cargar áreas.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = areas.find((a) => a.id === selectedAreaId) ?? null;

  const createArea = async (event: FormEvent) => {
    event.preventDefault();
    const missing = missingFieldsMessage({ nombre: newAreaName }, { nombre: 'nombre del área' });
    if (missing) {
      popup.error(missing);
      return;
    }
    const response = await fetch('/api/admin/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newAreaName }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo crear el área.'));
      return;
    }
    const body = (await response.json()) as { message?: string; data?: { id: string } };
    setNewAreaName('');
    popup.success(body.message ?? 'Área creada.');
    await load();
    if (body.data?.id) setSelectedAreaId(body.data.id);
  };

  const deleteArea = async (area: Area) => {
    const ok = await popup.confirm({
      message: `¿Eliminar el área "${area.nombre}" y sus destinos?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/areas/${area.id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar el área.'));
      return;
    }
    popup.success('Área eliminada.');
    setSelectedAreaId('');
    await load();
  };

  const createDestino = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAreaId) {
      popup.error('Seleccioná un área primero.');
      return;
    }
    const missing = missingFieldsMessage(
      { nombre: destinoForm.nombre, domicilio: destinoForm.domicilio },
      { nombre: 'nombre del destino', domicilio: 'domicilio' },
    );
    if (missing) {
      popup.error(missing);
      return;
    }
    const response = await fetch('/api/admin/destinos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId: selectedAreaId, ...destinoForm }),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo crear el destino.'));
      return;
    }
    setDestinoForm({ nombre: '', domicilio: '' });
    popup.success('Destino creado.');
    await load();
  };

  const deleteDestino = async (destino: Destino) => {
    const ok = await popup.confirm({
      message: `¿Eliminar destino "${destino.nombre}"?`,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/destinos/${destino.id}`, { method: 'DELETE' });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo eliminar el destino.'));
      return;
    }
    popup.success('Destino eliminado.');
    await load();
  };

  const startEditDestino = (destino: Destino) => {
    setEditingDestinoId(destino.id);
    setEditingDestino({ nombre: destino.nombre, domicilio: destino.domicilio });
  };

  const cancelEditDestino = () => {
    setEditingDestinoId(null);
    setEditingDestino({ nombre: '', domicilio: '' });
  };

  const updateDestino = async (destino: Destino) => {
    const missing = missingFieldsMessage(
      { nombre: editingDestino.nombre, domicilio: editingDestino.domicilio },
      { nombre: 'nombre del destino', domicilio: 'domicilio' },
    );
    if (missing) {
      popup.error(missing);
      return;
    }

    const response = await fetch(`/api/admin/destinos/${destino.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingDestino),
    });
    if (!response.ok) {
      popup.error(await readApiError(response, 'No se pudo actualizar el destino.'));
      return;
    }

    popup.success('Destino actualizado.');
    cancelEditDestino();
    await load();
  };

  if (loading) {
    return (
      <div className="admin-section">
        {popup.popupNode}
        <p className="panel-card__desc">Cargando áreas...</p>
      </div>
    );
  }

  return (
    <div className="admin-section">
      {popup.popupNode}

      <section className="panel-card">
        <h2>Áreas</h2>
        <p className="panel-card__desc">
          Solo Admin crea, modifica y elimina áreas y destinos. Administración los usa para asignar
          y armar grillas.
        </p>
        <form className="admin-grid-form admin-grid-form--2" onSubmit={createArea}>
          <div className="form-group">
            <label htmlFor="admin-area-nombre">Nueva área</label>
            <input
              id="admin-area-nombre"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder="Ej. San Miguel"
              required
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Crear área
          </button>
        </form>
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
          {!selected ? (
            <p className="panel-card__desc" style={{ margin: 0 }}>
              {areas.length === 0
                ? 'Creá un área para empezar.'
                : 'Seleccioná un área para gestionar destinos.'}
            </p>
          ) : (
            <div className="adm-area-detail">
              <div className="adm-assign-row" style={{ marginBottom: 'var(--space-sm)' }}>
                <p className="panel-card__desc" style={{ margin: 0, flex: 1 }}>
                  {selected._count.destinos} destino(s) · {selected._count.pasajeros} pasajero(s) en
                  área
                </p>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => void deleteArea(selected)}
                >
                  Eliminar área
                </button>
              </div>

              <section className="panel-card panel-card--nested">
                <h2>Destinos — {selected.nombre}</h2>
                <p className="panel-card__desc">Nombre y domicilio del lugar de destino.</p>
                <form className="admin-grid-form admin-grid-form--2" onSubmit={createDestino}>
                  <div className="form-group">
                    <label htmlFor="admin-dest-nombre">Nombre</label>
                    <input
                      id="admin-dest-nombre"
                      value={destinoForm.nombre}
                      onChange={(e) =>
                        setDestinoForm((p) => ({ ...p, nombre: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="admin-dest-dom">Domicilio</label>
                    <input
                      id="admin-dest-dom"
                      value={destinoForm.domicilio}
                      onChange={(e) =>
                        setDestinoForm((p) => ({ ...p, domicilio: e.target.value }))
                      }
                      placeholder="Calle, número, localidad"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn--primary">
                    Agregar destino
                  </button>
                </form>

                {selected.destinos.length === 0 ? (
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
                        {selected.destinos.map((destino) => (
                          <tr key={destino.id}>
                            <td>
                              {editingDestinoId === destino.id ? (
                                <input
                                  value={editingDestino.nombre}
                                  aria-label={`Nombre de ${destino.nombre}`}
                                  onChange={(e) =>
                                    setEditingDestino((prev) => ({
                                      ...prev,
                                      nombre: e.target.value,
                                    }))
                                  }
                                />
                              ) : (
                                destino.nombre
                              )}
                            </td>
                            <td>
                              {editingDestinoId === destino.id ? (
                                <input
                                  value={editingDestino.domicilio}
                                  aria-label={`Domicilio de ${destino.nombre}`}
                                  onChange={(e) =>
                                    setEditingDestino((prev) => ({
                                      ...prev,
                                      domicilio: e.target.value,
                                    }))
                                  }
                                />
                              ) : (
                                destino.domicilio
                              )}
                            </td>
                            <td>
                              <div className="admin-actions">
                                {editingDestinoId === destino.id ? (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn--primary btn--sm"
                                      onClick={() => void updateDestino(destino)}
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn--outline btn--sm"
                                      onClick={cancelEditDestino}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn--outline btn--sm"
                                      onClick={() => startEditDestino(destino)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn--danger btn--sm"
                                      onClick={() => void deleteDestino(destino)}
                                    >
                                      Eliminar
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
