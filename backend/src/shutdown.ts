import logger from './config/logger';
import { beginShutdown } from './lifecycle';

export const SHUTDOWN_TIMEOUT_MS = 15_000;

export type Stoppable = {
  stop(): void | Promise<void>;
  getStatus?: () => unknown;
  off?: (event: 'execution:finished' | 'execution:failed', handler: () => void) => void;
  once?: (event: 'execution:finished' | 'execution:failed', handler: () => void) => void;
};

type HttpServer = {
  close(callback: (error?: Error) => void): unknown;
  closeIdleConnections?: () => void;
};

type ShutdownLogger = Pick<typeof logger, 'error' | 'info'>;

type ShutdownDependencies = {
  server: HttpServer;
  jobs: Stoppable[];
  disconnectPrisma: () => Promise<void>;
  shutdownRedis: () => Promise<void>;
  exit?: (code: number) => void;
  log?: ShutdownLogger;
  timeoutMs?: number;
};

type CleanupCategory = 'http_server' | 'background_jobs' | 'redis' | 'database';

function closeServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  });
}

async function stopJob(job: Stoppable): Promise<void> {
  if (job.getStatus?.() !== 'running' || !job.once || !job.off) {
    await job.stop();
    return;
  }

  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const onFinished = (): void => {
    job.off?.('execution:finished', onFinished);
    job.off?.('execution:failed', onFinished);
    finish();
  };
  job.once('execution:finished', onFinished);
  job.once('execution:failed', onFinished);

  let stopError: unknown;
  try {
    await job.stop();
  } catch (error: unknown) {
    stopError = error;
  }
  await finished;
  if (stopError) throw stopError;
}

export function createShutdownCoordinator({
  server,
  jobs,
  disconnectPrisma,
  shutdownRedis,
  exit = process.exit,
  log = logger,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
}: ShutdownDependencies): (signal: NodeJS.Signals) => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;
  let terminated = false;

  const terminate = (code: number): void => {
    if (terminated) return;
    terminated = true;
    exit(code);
  };

  return (signal: NodeJS.Signals): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;

    beginShutdown();
    log.info('Graceful shutdown started', {
      event: 'shutdown_started',
      signal,
      outcome: 'draining',
    });

    const timeout = setTimeout(() => {
      log.error('Graceful shutdown timed out', {
        event: 'shutdown_forced',
        outcome: 'timeout',
      });
      terminate(1);
    }, timeoutMs);
    timeout.unref();

    shutdownPromise = (async () => {
      const drainResults = await Promise.allSettled([
        closeServer(server),
        ...jobs.map(stopJob),
      ]);

      const failed: CleanupCategory[] = [];
      if (drainResults[0].status === 'rejected') failed.push('http_server');
      if (drainResults.slice(1).some((result) => result.status === 'rejected')) {
        failed.push('background_jobs');
      }

      if (!failed.includes('background_jobs')) {
        log.info('Background jobs stopped', {
          event: 'background_jobs_stopped',
          outcome: 'success',
        });
      }

      const dependencyResults = await Promise.allSettled([
        Promise.resolve().then(shutdownRedis),
        Promise.resolve().then(disconnectPrisma),
      ]);
      if (dependencyResults[0].status === 'rejected') failed.push('redis');
      if (dependencyResults[1].status === 'rejected') failed.push('database');

      if (dependencyResults.every((result) => result.status === 'fulfilled')) {
        log.info('Dependencies closed', {
          event: 'shutdown_dependencies_closed',
          outcome: 'success',
        });
      }

      clearTimeout(timeout);
      if (terminated) return;

      if (failed.length > 0) {
        log.error('Graceful shutdown cleanup failed', {
          event: 'shutdown_failed',
          outcome: 'failure',
          errorCategory: failed[0],
        });
        terminate(1);
        return;
      }

      log.info('Graceful shutdown completed', {
        event: 'shutdown_completed',
        outcome: 'success',
      });
      terminate(0);
    })();

    return shutdownPromise;
  };
}
