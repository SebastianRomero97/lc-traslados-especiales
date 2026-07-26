import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/** Subir este número cuando un cambio de schema rompa el hot-reload (cliente viejo en global). */
const PRISMA_CLIENT_REV = 3;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaRev?: number;
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
  if (globalForPrisma.prismaRev !== PRISMA_CLIENT_REV) return false;

  const asAny = client as unknown as {
    grilla?: { findMany?: unknown };
    asistencia?: { findMany?: unknown };
    publicacion?: { findMany?: unknown };
  };
  return (
    typeof asAny.grilla?.findMany === 'function' &&
    typeof asAny.asistencia?.findMany === 'function' &&
    typeof asAny.publicacion?.findMany === 'function'
  );
}

function getPrismaClient() {
  if (isUsableClient(globalForPrisma.prisma)) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaRev = PRISMA_CLIENT_REV;
  return client;
}

export const prisma = getPrismaClient();
