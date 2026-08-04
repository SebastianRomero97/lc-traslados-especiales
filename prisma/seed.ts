import { hash } from 'bcryptjs';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Role } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta DATABASE_URL');
}

/** Si es true, el seed pisa passwords de usuarios seed (solo emergencia en dev). */
const RESET_PASSWORDS = process.env.SEED_RESET_PASSWORDS === 'true';
/** Si es true, también reescribe roles/active de usuarios seed existentes. */
const RESET_ROLES = process.env.SEED_RESET_ROLES === 'true';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/** Passwords débiles solo para bootstrap local. En prod: no correr seed; Admin cambia claves. */
const seedUsers: {
  username: string;
  password: string;
  roles: Role[];
  puedeAprobar?: boolean;
}[] = [
  { username: 'Hori', password: '1234', roles: ['ADMIN'] },
  { username: 'Gladis', password: '1234', roles: ['ADMIN'] },
  { username: 'Fernanda', password: '1234', roles: ['ADMINISTRACION'], puedeAprobar: true },
  { username: 'Camila', password: '1234', roles: ['CELADORA'] },
  { username: 'Seba', password: '1234', roles: ['CHOFER'] },
];

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ALLOW_PRODUCTION) {
    throw new Error(
      'Seed bloqueado en production. Definí SEED_ALLOW_PRODUCTION=true solo si sabés lo que hacés.',
    );
  }

  if (RESET_PASSWORDS) {
    console.warn('⚠ SEED_RESET_PASSWORDS=true → se reescriben contraseñas de usuarios seed.');
  }
  if (RESET_ROLES) {
    console.warn('⚠ SEED_RESET_ROLES=true → se reescriben roles/active de usuarios seed.');
  }

  for (const user of seedUsers) {
    const existing = await prisma.user.findUnique({ where: { username: user.username } });
    if (existing) {
      if (!RESET_PASSWORDS && !RESET_ROLES) {
        console.log(`· Usuario ${user.username} ya existe (sin cambios)`);
        continue;
      }
      await prisma.user.update({
        where: { username: user.username },
        data: {
          ...(RESET_ROLES
            ? {
                roles: user.roles,
                active: true,
                puedeAprobar: Boolean(user.puedeAprobar),
              }
            : {}),
          ...(RESET_PASSWORDS ? { passwordHash: await hash(user.password, 10) } : {}),
        },
      });
      console.log(
        `✓ Usuario ${user.username} actualizado${RESET_ROLES ? ' (roles)' : ''}${
          RESET_PASSWORDS ? ' (password)' : ''
        }`,
      );
    } else {
      const passwordHash = await hash(user.password, 10);
      await prisma.user.create({
        data: {
          username: user.username,
          passwordHash,
          roles: user.roles,
          active: true,
          puedeAprobar: Boolean(user.puedeAprobar),
        },
      });
      console.log(`✓ Usuario ${user.username} creado (${user.roles.join(', ')})`);
    }
  }

  const areasSeed = ['San Miguel', 'Villa de Mayo'];
  for (const nombre of areasSeed) {
    await prisma.area.upsert({
      where: { nombre },
      update: { active: true },
      create: { nombre, active: true },
    });
    console.log(`✓ Área ${nombre}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
