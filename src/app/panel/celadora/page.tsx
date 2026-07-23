import { PanelShell, requireRole } from '@/components/panel/PanelShell';

export default async function CeladoraPanelPage() {
  const user = await requireRole('CELADORA');

  return (
    <PanelShell user={user} title="Panel Celadora">
      <section className="panel-placeholder">
        <h2>Bienvenida, {user.username}</h2>
        <p>
          Acá vas a ver tu grilla, iniciar/finalizar recorrido y registrar la asistencia de cada
          pasajero. Próximamente.
        </p>
      </section>
    </PanelShell>
  );
}
