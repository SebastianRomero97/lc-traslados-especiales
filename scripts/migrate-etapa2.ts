import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  const rows = await prisma.areaPasajero.findMany({
    where: { destinoId: { not: null } },
  });
  console.log('rows with destinoId:', rows.length);

  let n = 0;
  for (const r of rows) {
    if (!r.destinoId) continue;
    await prisma.areaPasajeroDestino.upsert({
      where: {
        areaId_pasajeroId_destinoId: {
          areaId: r.areaId,
          pasajeroId: r.pasajeroId,
          destinoId: r.destinoId,
        },
      },
      create: {
        areaId: r.areaId,
        pasajeroId: r.pasajeroId,
        destinoId: r.destinoId,
      },
      update: {},
    });
    n++;
  }

  const grillas = await prisma.grilla.findMany({ include: { transporte: true } });
  let named = 0;
  for (const g of grillas) {
    if (g.nombre && g.nombre !== 'Sin nombre') continue;
    const fecha = g.fecha.toISOString().slice(0, 10);
    const tipo = g.tipoItinerario === 'INGRESO' ? 'Ingresos' : 'Salidas';
    await prisma.grilla.update({
      where: { id: g.id },
      data: { nombre: `${tipo} ${g.transporte.nombre} ${fecha}` },
    });
    named++;
  }

  const countJoin = await prisma.areaPasajeroDestino.count();
  console.log('Migrados destinos:', n, '| join total:', countJoin, '| grillas nombradas:', named);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
