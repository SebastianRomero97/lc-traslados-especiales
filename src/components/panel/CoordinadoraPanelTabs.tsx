'use client';

import { useState } from 'react';
import { CoordinadoraDashboard } from '@/components/panel/CoordinadoraDashboard';
import { CoordinadoraGrillasManager } from '@/components/panel/CoordinadoraGrillasManager';

type Tab = 'areas' | 'grillas';

export function CoordinadoraPanelTabs() {
  const [tab, setTab] = useState<Tab>('areas');

  return (
    <div>
      <div className="admin-tabs" role="tablist" aria-label="Secciones coordinadora">
        <button
          type="button"
          role="tab"
          className={`admin-tabs__btn${tab === 'areas' ? ' is-active' : ''}`}
          aria-selected={tab === 'areas'}
          onClick={() => setTab('areas')}
        >
          Áreas y asignaciones
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
      </div>

      {tab === 'areas' ? <CoordinadoraDashboard /> : <CoordinadoraGrillasManager />}
    </div>
  );
}
