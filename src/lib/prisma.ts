import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL en las variables de entorno.');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function isUsableClient(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  // Evita cliente viejo en hot-reload cuando se agregan modelos (ej. Grilla)
  const grilla = (client as unknown as { grilla?: { findMany?: unknown } }).grilla;
  return typeof grilla?.findMany === 'function';
}

function getPrismaClient() {
  if (isUsableClient(globalForPrisma.prisma)) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();
