'use client';

import { useState } from 'react';
import { AdminUsersManager } from '@/components/panel/AdminUsersManager';
import { AdminTransportesManager } from '@/components/panel/AdminTransportesManager';
import { AdminPasajerosManager } from '@/components/panel/AdminPasajerosManager';
import { AdminChoferesManager } from '@/components/panel/AdminChoferesManager';
import { NovedadesVehiculoPanel } from '@/components/panel/NovedadesVehiculoPanel';
import { InformeMetricasPanel } from '@/components/panel/InformeMetricasPanel';
import { AdminAreasManager } from '@/components/panel/AdminAreasManager';
import { AdminPublicacionesManager } from '@/components/panel/AdminPublicacionesManager';
import { RespaldoHistorialPanel } from '@/components/panel/RespaldoHistorialPanel';
import { AdminGrillasRevision } from '@/components/panel/AdminGrillasRevision';
import { AdministracionGrillasManager } from '@/components/panel/AdministracionGrillasManager';

type Tab =
  | 'usuarios'
  | 'areas'
  | 'grillas'
  | 'historial'
  | 'transportes'
  | 'pasajeros'
  | 'choferes'
  | 'informe'
  | 'respaldo'
  | 'publicaciones'
  | 'novedades';

const TABS: { id: Tab; label: string }[] = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'areas', label: 'Áreas' },
  { id: 'grillas', label: 'Grillas' },
  { id: 'historial', label: 'Historial' },
  { id: 'transportes', label: 'Transportes' },
  { id: 'pasajeros', label: 'Pasajeros' },
  { id: 'choferes', label: 'Choferes' },
  { id: 'informe', label: 'Informe' },
  { id: 'respaldo', label: 'Respaldo' },
  { id: 'publicaciones', label: 'Publicaciones' },
  { id: 'novedades', label: 'Novedades' },
];

export function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [tab, setTab] = useState<Tab>('usuarios');

  return (
    <div className="admin-dashboard">
      <div className="admin-tabs-shell">
        <div className="admin-tabs" role="tablist" aria-label="Secciones del panel admin">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`admin-tabs__btn${tab === item.id ? ' is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="admin-tabs__panel" role="tabpanel">
          {tab === 'usuarios' && <AdminUsersManager currentUserId={currentUserId} />}
          {tab === 'areas' && <AdminAreasManager />}
          {tab === 'grillas' && <AdminGrillasRevision />}
          {tab === 'historial' && (
            <AdministracionGrillasManager modo="historial" canDelete puedeAprobar />
          )}
          {tab === 'transportes' && <AdminTransportesManager />}
          {tab === 'pasajeros' && <AdminPasajerosManager />}
          {tab === 'choferes' && <AdminChoferesManager />}
          {tab === 'informe' && <InformeMetricasPanel />}
          {tab === 'respaldo' && <RespaldoHistorialPanel />}
          {tab === 'publicaciones' && <AdminPublicacionesManager />}
          {tab === 'novedades' && <NovedadesVehiculoPanel />}
        </div>
      </div>
    </div>
  );
}
