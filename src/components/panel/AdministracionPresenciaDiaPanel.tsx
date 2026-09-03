'use client';

import { useCallback, useEffect, useState } from 'react';
import { readApiError } from '@/lib/api-errors';
import { formatFechaGrilla, todayFechaInput } from '@/lib/grilla.utils';
import {
  ESTADOS_PRESENCIA,
  labelEstadoPresencia,
  type EstadoPresencia,
  type PresenciaDiaItem,
} from '@/lib/presencia-dia.utils';
import { usePanelPopup } from '@/components/panel/PanelPopup';

type PresenciaData = {
  fecha: string;
  items: PresenciaDiaItem[];
  resumen: { presente: number; ausente: number; retirado: number; enGrilla: number };
};

export function AdministracionPresenciaDiaPanel() {
  const popup = usePanelPopup();
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [data, setData] = useState<PresenciaData | null>(null);
  const fecha = todayFechaInput();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/administracion/presencia-dia?fecha=${encodeURIComponent(fecha)}`,
      );
      if (!res.ok) {
        popup.error(await readApiError(res, 'No se pudo cargar la presencia del día.'));
        setData(null);
        return;
      }
      const body = (await res.json()) as { data: PresenciaData };
      setData(body.data);
    } catch {
      popup.error('Error de conexión al cargar presencia.');
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup estable
  }, [fecha]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => {
      void load();
    };
    window.addEventListener('lc-presencia-updated', onUpdate);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('lc-presencia-updated', onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const setEstado = async (item: PresenciaDiaItem, estado: EstadoPresencia) => {
    if (item.enGrilla) {
      popup.error(
        'Este pasajero está en una grilla de salida. Sacalo de la grilla para cambiar el estado, o esperá: al salir vuelve al estado guardado.',
      );
      return;
    }
    if (item.estado === estado) return;
    setBusyKey(item.key);
    try {
      const res = await fetch('/api/administracion/presencia-dia', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          pasajeroId: item.pasajeroId,
          pasajeroNombre: item.pasajeroNombre,
          estado,
        }),
      });
      if (!res.ok) {
        popup.error(await readApiError(res, 'No se pudo actualizar.'));
        return;
      }
      const body = (await res.json()) as { message?: string };
      popup.success(body.message ?? 'Actualizado.');
      await load();
    } catch {
      popup.error('Error de conexión.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="presencia-dia">
      {popup.popupNode}
      <section className="panel-card">
        <h2>Presencia del día</h2>
        <p className="panel-card__desc">
          Lista unificada de ingresos de hoy ({formatFechaGrilla(fecha)}), según la asistencia de
          celadora. Al armar una salida, el pasajero pasa a “En grilla”. Al cambiar el día, esta vista
          se vacía sola.
        </p>
        {data && (
          <p className="presencia-dia__resumen">
            <span className="presencia-chip presencia-chip--presente">
              Presente {data.resumen.presente}
            </span>
            <span className="presencia-chip presencia-chip--ausente">
              Ausente {data.resumen.ausente}
            </span>
            <span className="presencia-chip presencia-chip--retirado">
              Retirado {data.resumen.retirado}
            </span>
            <span className="presencia-chip presencia-chip--engrilla">
              En grilla {data.resumen.enGrilla}
            </span>
          </p>
        )}
        <div className="admin-actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn btn--outline btn--sm" disabled={loading} onClick={() => void load()}>
            Actualizar
          </button>
        </div>
      </section>

      <section className="panel-card panel-card--nested">
        {loading && !data ? (
          <p className="panel-card__desc">Cargando…</p>
        ) : !data || data.items.length === 0 ? (
          <p className="panel-card__desc">
            Todavía no hay pasajeros para hoy. Cuando las celadoras envíen la asistencia de ingresos,
            van a aparecer acá.
          </p>
        ) : (
          <ul className="presencia-dia__lista">
            {data.items.map((item) => {
              const displayEstado = item.enGrilla ? 'EN_GRILLA' : item.estado;
              return (
                <li
                  key={item.key}
                  className={`presencia-dia__item presencia-dia__item--${displayEstado.toLowerCase()}`}
                >
                  <div className="presencia-dia__info">
                    <strong>{item.pasajeroNombre}</strong>
                    <span className="presencia-dia__meta">
                      {item.zonas.length > 0 ? item.zonas.join(' · ') : 'Sin zona'}
                      {item.viajoConLc === true
                        ? ' · Viajó con LC'
                        : item.viajoConLc === false
                          ? ' · No viajó con LC'
                          : ''}
                      {item.enGrilla && item.grillasSalida.length > 0
                        ? ` · ${item.grillasSalida.map((g) => g.transporte).join(', ')}`
                        : ''}
                    </span>
                  </div>
                  <div className="presencia-dia__acciones">
                    {item.enGrilla ? (
                      <span className="presencia-chip presencia-chip--engrilla">En grilla</span>
                    ) : (
                      ESTADOS_PRESENCIA.map((e) => (
                        <button
                          key={e.value}
                          type="button"
                          className={`btn btn--sm presencia-btn presencia-btn--${e.value.toLowerCase()}${
                            item.estado === e.value ? ' is-active' : ''
                          }`}
                          disabled={busyKey === item.key}
                          onClick={() => void setEstado(item, e.value)}
                        >
                          {e.label}
                        </button>
                      ))
                    )}
                    {!item.enGrilla && item.tieneOverride && (
                      <small className="presencia-dia__override">
                        Editado (default: {labelEstadoPresencia(item.estadoDefault)})
                      </small>
                    )}
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
