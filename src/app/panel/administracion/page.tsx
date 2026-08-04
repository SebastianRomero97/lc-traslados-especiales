import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { AdministracionPanelTabs } from '@/components/panel/AdministracionPanelTabs';
import { welcomeHeading } from '@/lib/greeting';
import { canApproveGrillas, hasRole } from '@/lib/roles';

export default async function AdministracionPanelPage() {
  const user = await requireRole(['ADMINISTRACION', 'ADMIN']);

  return (
    <PanelShell user={user}>
      <section className="panel-intro">
        <h2>{welcomeHeading(user.username)}</h2>
        <p>
          Asigná recursos a cada área y armá grillas (hojas de ruta) para el equipo. Las áreas y
          destinos los gestiona Admin.
        </p>
      </section>

      <AdministracionPanelTabs
        canDelete={hasRole(user, 'ADMIN')}
        puedeAprobar={canApproveGrillas(user)}
      />
    </PanelShell>
  );
}
