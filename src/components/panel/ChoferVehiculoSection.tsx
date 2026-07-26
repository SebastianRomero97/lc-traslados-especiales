'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type Transporte = {
  id: string;
  nombre: string;
  tipo: string;
  capacidad: number | null;
  active: boolean;
};

type Novedad = {
  id: string;
  mensaje: string;
  createdAt: string;
};

export function ChoferVehiculoSection() {
  const popup = usePanelPopup();
  const [transporte, setTransporte] = useState<Transporte | null>(null);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/operativo/vehiculo');
      const body = await response.json();
      if (!response.ok) {
        popup.error(body.message ?? 'No se pudo cargar el vehículo.');
        return;
      }
      setTransporte(body.data.transporte as Transporte | null);
      setNovedades(body.data.novedades as Novedad[]);
    } catch {
      popup.error('Error de conexión al cargar el vehículo.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/operativo/vehiculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje }),
      });
      if (!response.ok) {
        popup.error(await readApiError(response, 'No se pudo enviar la novedad.'));
        return;
      }
      const body = (await response.json()) as { message?: string };
      setMensaje('');
      popup.success(body.message ?? 'Novedad enviada.');
      await load();
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="panel-card">
        {popup.popupNode}
        <p className="panel-card__desc">Cargando vehículo...</p>
      </section>
    );
  }

  return (
    <div className="chofer-vehiculo">
      {popup.popupNode}

      <section className="panel-card">
        <h2>Vehículo asignado</h2>
        {!transporte ? (
          <p className="panel-card__desc">
            Todavía no tenés un vehículo asignado. Pedile al Admin que te asigne uno en la pestaña
            Choferes.
          </p>
        ) : (
          <>
            <dl className="chofer-vehiculo__detalle">
              <div>
                <dt>Nombre</dt>
                <dd>{transporte.nombre}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{transporte.tipo}</dd>
              </div>
              <div>
                <dt>Capacidad</dt>
                <dd>{transporte.capacidad ?? '—'}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{transporte.active ? 'Activo' : 'No disponible'}</dd>
              </div>
            </dl>

            <h3 className="chofer-vehiculo__subtitulo">Notificar novedad</h3>
            <p className="panel-card__desc">
              Cualquier novedad (falla, ruido, luces, etc.) queda visible para Admin y Coordinadora.
            </p>
            <form className="chofer-vehiculo__form" onSubmit={handleSubmit}>
              <textarea
                className="operativo-informe"
                rows={3}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Ej: Ruido en la rueda delantera derecha al frenar"
                required
                minLength={5}
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || mensaje.trim().length < 5}
              >
                {submitting ? 'Enviando...' : 'Enviar novedad'}
              </button>
            </form>
          </>
        )}
      </section>

      {transporte && (
        <section className="panel-card">
          <h2>Tus novedades enviadas</h2>
          {novedades.length === 0 ? (
            <p className="panel-card__desc">Todavía no enviaste novedades sobre este vehículo.</p>
          ) : (
            <ul className="chofer-vehiculo__novedades">
              {novedades.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString('es-AR')}
                  </time>
                  <p>{n.mensaje}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
