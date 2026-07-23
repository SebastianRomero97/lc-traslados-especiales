import { PanelShell, requireRole } from '@/components/panel/PanelShell';

export default async function CoordinadoraPanelPage() {
  const user = await requireRole('COORDINADORA');

  return (
    <PanelShell user={user} title="Panel Coordinadora">
      <section className="panel-placeholder">
        <h2>Bienvenida, {user.username}</h2>
        <p>
          Acá vas a gestionar áreas, destinos, asignaciones y grillas. Esta pantalla se completa
          en las próximas fases.
        </p>
      </section>
    </PanelShell>
  );
}
