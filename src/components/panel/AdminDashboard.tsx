'use client';

import { useState } from 'react';
import { AdminUsersManager } from '@/components/panel/AdminUsersManager';
import { AdminTransportesManager } from '@/components/panel/AdminTransportesManager';
import { AdminPasajerosManager } from '@/components/panel/AdminPasajerosManager';
import { AdminChoferesManager } from '@/components/panel/AdminChoferesManager';
import { NovedadesVehiculoPanel } from '@/components/panel/NovedadesVehiculoPanel';
import { InformeMetricasPanel } from '@/components/panel/InformeMetricasPanel';
import { AdminPublicacionesManager } from '@/components/panel/AdminPublicacionesManager';
import { RespaldoHistorialPanel } from '@/components/panel/RespaldoHistorialPanel';

type Tab =
  | 'usuarios'
  | 'transportes'
  | 'pasajeros'
  | 'choferes'
  | 'informe'
  | 'respaldo'
  | 'publicaciones'
  | 'novedades';

const TABS: { id: Tab; label: string }[] = [
  { id: 'usuarios', label: 'Usuarios' },
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
        {tab === 'transportes' && <AdminTransportesManager />}
        {tab === 'pasajeros' && <AdminPasajerosManager />}
        {tab === 'choferes' && <AdminChoferesManager />}
        {tab === 'informe' && <InformeMetricasPanel />}
        {tab === 'respaldo' && <RespaldoHistorialPanel />}
        {tab === 'publicaciones' && <AdminPublicacionesManager />}
        {tab === 'novedades' && <NovedadesVehiculoPanel />}
      </div>
    </div>
  );
}
