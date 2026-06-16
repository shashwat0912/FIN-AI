import { PrismaClient } from '@prisma/client';
import logger from './logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

function normalizeSqliteDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || !databaseUrl.startsWith('file:')) {
    return;
  }

  // Legacy config used "file:./prisma/dev.db", which resolves to prisma/prisma/dev.db.
  // Normalize to "file:./dev.db" so the backend always uses the intended database file.
  const normalizedUrl = databaseUrl.replace(/^file:\.\/prisma\//, 'file:./');

  if (normalizedUrl !== databaseUrl) {
    process.env.DATABASE_URL = normalizedUrl;
    logger.warn(`Normalized DATABASE_URL from "${databaseUrl}" to "${normalizedUrl}"`);
  }
}

normalizeSqliteDatabaseUrl();

const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;
