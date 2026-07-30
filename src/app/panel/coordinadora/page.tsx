import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { CoordinadoraPanelTabs } from '@/components/panel/CoordinadoraPanelTabs';
import { welcomeHeading } from '@/lib/greeting';

export default async function CoordinadoraPanelPage() {
  const user = await requireRole(['COORDINADORA', 'ADMIN']);

  return (
    <PanelShell user={user} title="Panel Administración">
      <section className="panel-intro">
        <h2>{welcomeHeading(user.username)}</h2>
        <p>
          Elegí un área, asigná recursos y armá grillas (hojas de ruta) para el equipo. Las áreas y
          destinos los gestiona Admin.
        </p>
      </section>

      <CoordinadoraPanelTabs />
    </PanelShell>
  );
}
