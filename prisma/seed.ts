import { hash } from 'bcryptjs';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta DATABASE_URL');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const seedUsers = [
  { username: 'Hori', password: '1234', role: 'ADMIN' as const },
  { username: 'Fernanda', password: '1234', role: 'COORDINADORA' as const },
  { username: 'Camila', password: '1234', role: 'CELADORA' as const },
  { username: 'Seba', password: '1234', role: 'CHOFER' as const },
];

async function main() {
  for (const user of seedUsers) {
    const passwordHash = await hash(user.password, 10);
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash,
        role: user.role,
        active: true,
      },
      create: {
        username: user.username,
        passwordHash,
        role: user.role,
        active: true,
      },
    });
    console.log(`✓ Usuario ${user.username} (${user.role})`);
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
