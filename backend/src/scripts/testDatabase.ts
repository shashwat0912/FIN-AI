import { spawnSync } from 'child_process';

export const LOCAL_TEST_DATABASE_URL =
  'postgresql://financeai_test@localhost:5433/finance_ai_test';

const BLOCKED_DATABASES = new Set(['financeai', 'finance_ai_db']);

export function assertSafeTestDatabase(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  if (nodeEnv !== 'test') {
    throw new Error('Refusing database test operation unless NODE_ENV=test.');
  }
  if (!databaseUrl) {
    throw new Error('A dedicated PostgreSQL test DATABASE_URL is required.');
  }

  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('The test database must use PostgreSQL.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.slice(1)).toLowerCase();
  if (
    !databaseName.endsWith('_test') ||
    BLOCKED_DATABASES.has(databaseName)
  ) {
    throw new Error(
      `Refusing unsafe test database "${databaseName || '(missing)'}".`
    );
  }

  return databaseName;
}

export function resolveTestDatabaseUrl(): string {
  return (
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    LOCAL_TEST_DATABASE_URL
  );
}

function run(): void {
  const action = process.argv[2];
  const databaseUrl = resolveTestDatabaseUrl();
  const databaseName = assertSafeTestDatabase(databaseUrl);

  if (action === 'guard') {
    process.stdout.write(`Safe PostgreSQL test database: ${databaseName}\n`);
    return;
  }

  const args =
    action === 'deploy'
      ? ['prisma', 'migrate', 'deploy']
      : action === 'reset'
        ? ['prisma', 'migrate', 'reset', '--force', '--skip-seed']
        : null;

  if (!args) {
    throw new Error('Expected test database action: guard, deploy, or reset.');
  }

  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

