import { PanelShell, requireRole } from '@/components/panel/PanelShell';

export default async function ChoferPanelPage() {
  const user = await requireRole('CHOFER');

  return (
    <PanelShell user={user} title="Panel Chofer">
      <section className="panel-placeholder">
        <h2>Bienvenido, {user.username}</h2>
        <p>
          Acá vas a ver tu grilla, marcar inicio/fin de manejo, abrir rutas en Maps/Waze y completar
          el informe. Próximamente.
        </p>
      </section>
    </PanelShell>
  );
}
