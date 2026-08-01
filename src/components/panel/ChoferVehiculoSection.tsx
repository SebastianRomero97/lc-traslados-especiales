'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { usePanelPopup } from '@/components/panel/PanelPopup';
import {
  dateToInput,
  labelEstadoNovedad,
  labelEstadoVtv,
  type EstadoVtv,
} from '@/lib/transporte.utils';

type Transporte = {
  id: string;
  nombre: string;
  tipo: string;
  capacidad: number | null;
  anio: number | null;
  patente: string | null;
  servicePendiente: string | null;
  serviceFecha: string | null;
  vtvVenceAt: string | null;
  vtvEstado: EstadoVtv;
  active: boolean;
};

type Novedad = {
  id: string;
  mensaje: string;
  estado: 'PENDIENTE_REVISION' | 'RESUELTO';
  detalleAdmin: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ChoferVehiculoSection({ isPrestador = false }: { isPrestador?: boolean }) {
  const popup = usePanelPopup();
  const [transporte, setTransporte] = useState<Transporte | null>(null);
  const [fuente, setFuente] = useState<'asignado' | 'grilla' | null>(null);
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
      setFuente((body.data.fuente as 'asignado' | 'grilla' | null) ?? null);
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
            {isPrestador
              ? 'Como prestador usás vehículo propio. Cuando tengas una grilla del día, vas a ver acá los datos del vehículo del recorrido para consultar y reportar novedades.'
              : 'Todavía no tenés un vehículo asignado. Pedile al Admin que te asigne uno en la pestaña Choferes.'}
          </p>
        ) : (
          <>
            {fuente === 'grilla' ? (
              <p className="panel-card__desc">
                Datos del vehículo de tu grilla de hoy (prestador / vehículo propio del recorrido).
              </p>
            ) : null}
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
                <dt>Año</dt>
                <dd>{transporte.anio ?? '—'}</dd>
              </div>
              <div>
                <dt>Patente</dt>
                <dd>{transporte.patente ?? '—'}</dd>
              </div>
              <div>
                <dt>Service pendiente</dt>
                <dd>
                  {transporte.servicePendiente ?? '—'}
                  {transporte.serviceFecha
                    ? ` (${dateToInput(transporte.serviceFecha)})`
                    : ''}
                </dd>
              </div>
              <div>
                <dt>VTV</dt>
                <dd>
                  {transporte.vtvVenceAt
                    ? `${dateToInput(transporte.vtvVenceAt)} · ${labelEstadoVtv(transporte.vtvEstado)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{transporte.active ? 'Activo' : 'No disponible'}</dd>
              </div>
            </dl>
            <p className="panel-card__desc">
              Estos datos los carga el Admin. Vos solo podés consultarlos y reportar novedades.
            </p>

            <h3 className="chofer-vehiculo__subtitulo">Notificar novedad</h3>
            <p className="panel-card__desc">
              La novedad se guarda en el historial de este vehículo. Admin puede marcarla como
              pendiente o resuelta.
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
          <h2>Historial de novedades</h2>
          {novedades.length === 0 ? (
            <p className="panel-card__desc">Todavía no hay novedades sobre este vehículo.</p>
          ) : (
            <ul className="chofer-vehiculo__novedades">
              {novedades.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString('es-AR')}
                  </time>
                  <p>
                    <strong>{labelEstadoNovedad(n.estado)}</strong> — {n.mensaje}
                  </p>
                  {n.detalleAdmin && (
                    <p className="chofer-vehiculo__detalle-admin">Admin: {n.detalleAdmin}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
