import { Router } from 'express';
import prisma from '../config/database';
import { config } from '../config/env';
import logger from '../config/logger';
import { getRedisState, isRedisReady, pingRedis } from '../config/redis';
import { isShuttingDown } from '../lifecycle';

type Dependency = 'database' | 'redis';
type ErrorCategory = 'fallback' | 'timeout' | 'unavailable';
type CheckResult = {
  status: 'up' | 'down';
  errorCategory?: ErrorCategory;
};

const router = Router();
const dependencyTimeoutMs = 1000;
const failureLogThrottleMs = 30_000;
const lastFailureLog = new Map<Dependency, number>();

class DependencyTimeoutError extends Error {}

async function withTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new DependencyTimeoutError()), dependencyTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function errorCategory(error: unknown): ErrorCategory {
  return error instanceof DependencyTimeoutError ? 'timeout' : 'unavailable';
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`);
    return { status: 'up' };
  } catch (error: unknown) {
    return { status: 'down', errorCategory: errorCategory(error) };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const state = getRedisState();
  if (state === 'fallback') {
    return config.NODE_ENV === 'production'
      ? { status: 'down', errorCategory: 'fallback' }
      : { status: 'up' };
  }
  if (state === 'shutting_down') {
    return { status: 'down', errorCategory: 'unavailable' };
  }

  try {
    await withTimeout(pingRedis());
    return isRedisReady() ? { status: 'up' } : { status: 'down', errorCategory: 'unavailable' };
  } catch (error: unknown) {
    if (getRedisState() === 'fallback' && config.NODE_ENV !== 'production') {
      return { status: 'up' };
    }
    return { status: 'down', errorCategory: errorCategory(error) };
  }
}

function logFailure(dependency: Dependency, category: ErrorCategory): void {
  const now = Date.now();
  const lastLoggedAt = lastFailureLog.get(dependency) ?? 0;

  if (now - lastLoggedAt < failureLogThrottleMs) return;

  lastFailureLog.set(dependency, now);
  logger.warn('Readiness dependency unavailable', {
    event: 'readiness_check',
    dependency,
    outcome: 'down',
    errorCategory: category,
  });
}

router.get('/livez', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

router.get('/readyz', async (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({
      status: 'not_ready',
      reason: 'shutting_down',
      checks: { database: 'up', redis: 'down' },
    });
    return;
  }

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  if (database.status === 'down') {
    logFailure('database', database.errorCategory ?? 'unavailable');
  }
  if (redis.status === 'down') {
    logFailure('redis', redis.errorCategory ?? 'unavailable');
  }

  const ready = database.status === 'up' && redis.status === 'up';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      database: database.status,
      redis: redis.status,
    },
  });
});

export default router;
