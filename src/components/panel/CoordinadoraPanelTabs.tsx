'use client';

import { useState } from 'react';
import { CoordinadoraDashboard } from '@/components/panel/CoordinadoraDashboard';
import { CoordinadoraGrillasManager } from '@/components/panel/CoordinadoraGrillasManager';
import { NovedadesVehiculoPanel } from '@/components/panel/NovedadesVehiculoPanel';
import { InformeMetricasPanel } from '@/components/panel/InformeMetricasPanel';
import { RespaldoHistorialPanel } from '@/components/panel/RespaldoHistorialPanel';
import { PublicacionesBanner } from '@/components/panel/PublicacionesBanner';

type Tab = 'areas' | 'grillas' | 'historial' | 'informe' | 'respaldo' | 'novedades';

export function CoordinadoraPanelTabs() {
  const [tab, setTab] = useState<Tab>('areas');

  return (
    <div>
      <PublicacionesBanner />

      <div className="admin-tabs-shell">
        <div className="admin-tabs" role="tablist" aria-label="Secciones administración">
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${tab === 'areas' ? ' is-active' : ''}`}
            aria-selected={tab === 'areas'}
            onClick={() => setTab('areas')}
          >
            Área y asignaciones
          </button>
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${tab === 'grillas' ? ' is-active' : ''}`}
            aria-selected={tab === 'grillas'}
            onClick={() => setTab('grillas')}
          >
            Grillas
          </button>
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${tab === 'historial' ? ' is-active' : ''}`}
            aria-selected={tab === 'historial'}
            onClick={() => setTab('historial')}
          >
            Historial
          </button>
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${tab === 'informe' ? ' is-active' : ''}`}
            aria-selected={tab === 'informe'}
            onClick={() => setTab('informe')}
          >
            Informe
          </button>
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${tab === 'respaldo' ? ' is-active' : ''}`}
            aria-selected={tab === 'respaldo'}
            onClick={() => setTab('respaldo')}
          >
            Respaldo
          </button>
          <button
            type="button"
            role="tab"
            className={`admin-tabs__btn${tab === 'novedades' ? ' is-active' : ''}`}
            aria-selected={tab === 'novedades'}
            onClick={() => setTab('novedades')}
          >
            Novedades
          </button>
        </div>

        <div className="admin-tabs__panel" role="tabpanel">
          {tab === 'areas' && <CoordinadoraDashboard />}
          {tab === 'grillas' && <CoordinadoraGrillasManager modo="principal" />}
          {tab === 'historial' && <CoordinadoraGrillasManager modo="historial" />}
          {tab === 'informe' && <InformeMetricasPanel />}
          {tab === 'respaldo' && <RespaldoHistorialPanel />}
          {tab === 'novedades' && <NovedadesVehiculoPanel />}
        </div>
      </div>
    </div>
  );
}
