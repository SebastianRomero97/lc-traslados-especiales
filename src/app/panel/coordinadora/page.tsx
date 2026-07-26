import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { CoordinadoraPanelTabs } from '@/components/panel/CoordinadoraPanelTabs';
import { welcomeHeading } from '@/lib/greeting';

export default async function CoordinadoraPanelPage() {
  const user = await requireRole(['COORDINADORA', 'ADMIN']);

  return (
    <PanelShell user={user} title="Panel Coordinadora">
      <section className="panel-intro">
        <h2>{welcomeHeading(user.username)}</h2>
        <p>
          Gestioná áreas, asignaciones y grillas (hojas de ruta) para compartir con el equipo.
        </p>
      </section>

      <CoordinadoraPanelTabs />
    </PanelShell>
  );
}
