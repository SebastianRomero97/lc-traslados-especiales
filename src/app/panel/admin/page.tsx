import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { AdminDashboard } from '@/components/panel/AdminDashboard';

export default async function AdminPanelPage() {
  const user = await requireRole('ADMIN');

  return (
    <PanelShell user={user} title="Panel Admin">
      <section className="panel-intro">
        <h2>Bienvenida, {user.username}</h2>
        <p>
          Gestioná usuarios, transportes, pasajeros y la asignación de vehículos a choferes.
        </p>
      </section>

      <AdminDashboard currentUserId={user.id} />
    </PanelShell>
  );
}
