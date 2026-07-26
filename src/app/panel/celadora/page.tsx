import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { OperativoPanel } from '@/components/panel/OperativoPanel';
import { PublicacionesBanner } from '@/components/panel/PublicacionesBanner';
import { welcomeHeading } from '@/lib/greeting';

export default async function CeladoraPanelPage() {
  const user = await requireRole('CELADORA');

  return (
    <PanelShell user={user} title="Panel Celadora">
      <section className="panel-intro">
        <h2>{welcomeHeading(user.username)}</h2>
        <p>
          Revisá tu grilla, iniciá/finalizá el tramo de pasajeros, registrá asistencia y completá el
          informe.
        </p>
      </section>

      <PublicacionesBanner />
      <OperativoPanel rol="CELADORA" />
    </PanelShell>
  );
}
