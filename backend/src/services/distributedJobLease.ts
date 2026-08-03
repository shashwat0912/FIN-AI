import { randomUUID } from 'crypto';
import { config } from '../config/env';
import logger from '../config/logger';
import {
  RedisUnavailableError,
  runRedisOperation,
  type RedisClient,
} from '../config/redis';
import { isShuttingDown } from '../lifecycle';

export type JobName = 'state-expiry' | 'idempotency-cleanup' | 'summarization';
export type JobLease = {
  job: JobName;
  token: string;
  durationMs: number;
  local: boolean;
};

type RedisOperation = <T>(operation: (client: RedisClient) => Promise<T>) => Promise<T>;
type JobWork = (stillOwner: () => boolean) => Promise<void>;

const JOB_LEASE_MS = 60_000;
const activeRenewals = new Set<() => void>();
const releaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;
const renewScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;

function leaseKey(job: JobName): string {
  return `jobs:lease:${job}`;
}

export function stopJobLeaseRenewals(): void {
  for (const stop of activeRenewals) stop();
  activeRenewals.clear();
}

export class DistributedJobLease {
  private readonly localOwners = new Map<JobName, string>();
  private readonly unavailableLogged = new Set<JobName>();

  constructor(
    private readonly operation: RedisOperation = runRedisOperation,
    private readonly useLocalFallback = config.NODE_ENV !== 'production'
  ) {}

  async acquireJobLease(job: JobName, durationMs = JOB_LEASE_MS): Promise<JobLease | null> {
    const token = randomUUID();
    if (this.useLocalFallback) {
      // ponytail: non-production ownership is process-local; production always uses Redis.
      if (this.localOwners.has(job)) return null;
      this.localOwners.set(job, token);
      return { job, token, durationMs, local: true };
    }

    const acquired = await this.operation(client =>
      client.set(leaseKey(job), token, 'PX', durationMs, 'NX')
    );
    return acquired === 'OK' ? { job, token, durationMs, local: false } : null;
  }

  async renewJobLease(lease: JobLease): Promise<boolean> {
    if (lease.local) return this.localOwners.get(lease.job) === lease.token;
    const renewed = await this.operation(client =>
      client.eval(renewScript, 1, leaseKey(lease.job), lease.token, lease.durationMs)
    );
    return Number(renewed) === 1;
  }

  async releaseJobLease(lease: JobLease): Promise<boolean> {
    if (lease.local) {
      if (this.localOwners.get(lease.job) !== lease.token) return false;
      this.localOwners.delete(lease.job);
      return true;
    }
    const released = await this.operation(client =>
      client.eval(releaseScript, 1, leaseKey(lease.job), lease.token)
    );
    return Number(released) === 1;
  }

  async runJob(
    job: JobName,
    work: JobWork,
    durationMs = JOB_LEASE_MS
  ): Promise<boolean> {
    if (isShuttingDown()) return false;

    let lease: JobLease | null;
    try {
      lease = await this.acquireJobLease(job, durationMs);
    } catch (error: unknown) {
      this.logUnavailable(job, error);
      return false;
    }
    this.unavailableLogged.delete(job);
    if (!lease) return false;
    if (isShuttingDown()) {
      try {
        await this.releaseJobLease(lease);
      } catch (error: unknown) {
        this.logUnavailable(job, error);
      }
      return false;
    }

    let owned = true;
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;
    let renewal = Promise.resolve();
    const stopRenewal = (): void => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    const scheduleRenewal = (): void => {
      timer = setTimeout(() => {
        renewal = this.renewJobLease(lease!)
          .then(renewed => {
            if (!renewed) {
              owned = false;
              logger.warn('Distributed job ownership lost', {
                event: 'distributed_job',
                job,
                outcome: 'ownership_lost',
                errorCategory: 'lease_mismatch',
              });
            }
          })
          .catch((error: unknown) => {
            owned = false;
            this.logUnavailable(job, error);
          })
          .finally(() => {
            if (!stopped && owned) scheduleRenewal();
          });
      }, Math.max(1, Math.floor(durationMs / 3)));
      timer.unref();
    };

    activeRenewals.add(stopRenewal);
    if (!lease.local) scheduleRenewal();
    try {
      await work(() => owned && !stopped);
      return true;
    } finally {
      stopRenewal();
      activeRenewals.delete(stopRenewal);
      await renewal;
      try {
        const released = await this.releaseJobLease(lease);
        if (!released && owned) {
          logger.warn('Distributed job ownership lost', {
            event: 'distributed_job',
            job,
            outcome: 'ownership_lost',
            errorCategory: 'lease_mismatch',
          });
        }
      } catch (error: unknown) {
        this.logUnavailable(job, error);
      }
    }
  }

  private logUnavailable(job: JobName, error: unknown): void {
    if (this.unavailableLogged.has(job)) return;
    this.unavailableLogged.add(job);
    logger.warn('Distributed job unavailable', {
      event: 'distributed_job',
      job,
      outcome: 'unavailable',
      errorCategory: error instanceof RedisUnavailableError ? 'redis_unavailable' : 'unknown',
    });
  }
}

export const distributedJobLease = new DistributedJobLease();
