import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdownCoordinator, SHUTDOWN_TIMEOUT_MS } from '../src/shutdown';
import type { Stoppable } from '../src/shutdown';

const importMocks = vi.hoisted(() => ({
  startStateExpiryJob: vi.fn(),
  startIdempotencyCleanupJob: vi.fn(),
  startSummarizationJob: vi.fn(),
}));

vi.mock('../src/jobs/stateExpiryJob', () => ({
  startStateExpiryJob: importMocks.startStateExpiryJob,
}));
vi.mock('../src/jobs/idempotencyCleanupJob', () => ({
  startIdempotencyCleanupJob: importMocks.startIdempotencyCleanupJob,
}));
vi.mock('../src/jobs/summarizationJob', () => ({
  startSummarizationJob: importMocks.startSummarizationJob,
}));
vi.mock('../src/routes', () => ({
  default: (
    _req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction
  ) => next(),
}));

function createDependencies(closeError?: Error) {
  const close = vi.fn((callback: (error?: Error) => void) => callback(closeError));
  const closeIdleConnections = vi.fn();
  const jobs: Stoppable[] = [
    { stop: vi.fn() },
    { stop: vi.fn() },
    { stop: vi.fn() },
  ];
  const disconnectPrisma = vi.fn().mockResolvedValue(undefined);
  const shutdownRedis = vi.fn().mockResolvedValue(undefined);
  const exit = vi.fn();
  const log = { error: vi.fn(), info: vi.fn() };

  return {
    dependencies: {
      server: { close, closeIdleConnections },
      jobs,
      disconnectPrisma,
      shutdownRedis,
      exit,
      log,
    },
    close,
    closeIdleConnections,
    jobs,
    disconnectPrisma,
    shutdownRedis,
    exit,
    log,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('graceful shutdown', () => {
  it('runs cleanup and exits successfully exactly once', async () => {
    const context = createDependencies();
    const shutdown = createShutdownCoordinator(context.dependencies);

    const first = shutdown('SIGTERM');
    const repeated = shutdown('SIGINT');

    expect(repeated).toBe(first);
    expect(context.close).toHaveBeenCalledOnce();
    await first;

    expect(context.closeIdleConnections).toHaveBeenCalledOnce();
    for (const job of context.jobs) expect(job.stop).toHaveBeenCalledOnce();
    expect(context.shutdownRedis).toHaveBeenCalledOnce();
    expect(context.disconnectPrisma).toHaveBeenCalledOnce();
    expect(context.exit).toHaveBeenCalledOnce();
    expect(context.exit).toHaveBeenCalledWith(0);
    expect(context.log.info).toHaveBeenCalledWith('Graceful shutdown completed', {
      event: 'shutdown_completed',
      outcome: 'success',
    });
  });

  it('categorises cleanup failures without logging raw error details', async () => {
    const sensitiveError = new Error('postgresql://user:password@private-host/database');
    const context = createDependencies(sensitiveError);
    const shutdown = createShutdownCoordinator(context.dependencies);

    await shutdown('SIGTERM');

    expect(context.shutdownRedis).toHaveBeenCalledOnce();
    expect(context.disconnectPrisma).toHaveBeenCalledOnce();
    expect(context.exit).toHaveBeenCalledWith(1);
    expect(context.log.error).toHaveBeenCalledWith('Graceful shutdown cleanup failed', {
      event: 'shutdown_failed',
      outcome: 'failure',
      errorCategory: 'http_server',
    });
    expect(JSON.stringify(context.log.error.mock.calls)).not.toContain(sensitiveError.message);
  });

  it('waits for an active scheduled job before disconnecting dependencies', async () => {
    const handlers = new Map<string, () => void>();
    const context = createDependencies();
    context.dependencies.jobs = [
      {
        getStatus: () => 'running',
        off: vi.fn((event: string) => handlers.delete(event)),
        once: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
        stop: vi.fn(),
      },
    ];
    const shutdown = createShutdownCoordinator(context.dependencies);

    const result = shutdown('SIGTERM');
    await Promise.resolve();

    expect(context.shutdownRedis).not.toHaveBeenCalled();
    expect(context.disconnectPrisma).not.toHaveBeenCalled();

    handlers.get('execution:finished')?.();
    await result;

    expect(context.shutdownRedis).toHaveBeenCalledOnce();
    expect(context.disconnectPrisma).toHaveBeenCalledOnce();
    expect(context.exit).toHaveBeenCalledWith(0);
  });

  it('forces one non-zero exit when cleanup exceeds the deadline', async () => {
    vi.useFakeTimers();
    const context = createDependencies();
    context.dependencies.server.close = vi.fn();
    const shutdown = createShutdownCoordinator(context.dependencies);

    const first = shutdown('SIGTERM');
    const repeated = shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS);

    expect(repeated).toBe(first);
    expect(context.dependencies.server.close).toHaveBeenCalledOnce();
    expect(context.exit).toHaveBeenCalledOnce();
    expect(context.exit).toHaveBeenCalledWith(1);
    expect(context.log.error).toHaveBeenCalledWith('Graceful shutdown timed out', {
      event: 'shutdown_forced',
      outcome: 'timeout',
    });
  });

  it('closes real Redis gracefully and abandons fallback connections without throwing', async () => {
    const handlers = new Map<string, () => void>();
    const redis = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
      quit: vi.fn().mockResolvedValue('OK'),
    };

    vi.resetModules();
    vi.doMock('ioredis', () => ({
      default: vi.fn(function RedisMock() {
        return redis;
      }),
    }));
    vi.doMock('../src/config/logger', () => ({
      default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    }));
    const { getRedisClient, shutdownRedis } = await import('../src/config/redis');

    getRedisClient();
    handlers.get('error')?.();
    await expect(shutdownRedis()).resolves.toBeUndefined();
    expect(redis.disconnect).toHaveBeenCalledOnce();
    expect(redis.quit).not.toHaveBeenCalled();

    getRedisClient();
    await shutdownRedis();
    expect(redis.quit).toHaveBeenCalledOnce();
  });

  it('does not start jobs or install signal handlers when the Express app is imported', async () => {
    const sigtermListeners = process.listenerCount('SIGTERM');
    const sigintListeners = process.listenerCount('SIGINT');

    await import('../src/index');

    expect(importMocks.startStateExpiryJob).not.toHaveBeenCalled();
    expect(importMocks.startIdempotencyCleanupJob).not.toHaveBeenCalled();
    expect(importMocks.startSummarizationJob).not.toHaveBeenCalled();
    expect(process.listenerCount('SIGTERM')).toBe(sigtermListeners);
    expect(process.listenerCount('SIGINT')).toBe(sigintListeners);
  });
});
