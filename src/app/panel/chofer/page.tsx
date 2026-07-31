import { PanelShell, requireRole } from '@/components/panel/PanelShell';
import { OperativoPanel } from '@/components/panel/OperativoPanel';
import { PublicacionesBanner } from '@/components/panel/PublicacionesBanner';
import { welcomeHeading } from '@/lib/greeting';

export default async function ChoferPanelPage() {
  const user = await requireRole('CHOFER');

  return (
    <PanelShell user={user}>
      <section className="panel-intro">
        <h2>{welcomeHeading(user.username)}</h2>
        <p>
          Iniciá/finalizá el manejo, abrí direcciones en Maps o Waze
          {', '}
          registrá asistencia si el recorrido va sin celadora, y completá el informe.
        </p>
      </section>

      <PublicacionesBanner />
      <OperativoPanel rol="CHOFER" isPrestador={Boolean(user.isPrestador)} />
    </PanelShell>
  );
}
