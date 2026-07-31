import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { AdminDashboard } from '@/components/panel/AdminDashboard';
import { welcomeHeading } from '@/lib/greeting';

export default async function AdminPanelPage() {
  const user = await requireRole('ADMIN');

  return (
    <PanelShell user={user}>
      <section className="panel-intro">
        <h2>{welcomeHeading(user.username)}</h2>
        <p>
          Gestioná usuarios, catálogos, informe de métricas, publicaciones y novedades de
          vehículos.
        </p>
      </section>

      <AdminDashboard currentUserId={user.id} />
    </PanelShell>
  );
}
