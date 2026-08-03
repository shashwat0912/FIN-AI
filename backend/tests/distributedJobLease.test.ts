import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisUnavailableError, type RedisClient } from '../src/config/redis';

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));
const lifecycle = vi.hoisted(() => ({
  isShuttingDown: vi.fn(() => false),
}));

vi.mock('../src/config/logger', () => ({ default: logger }));
vi.mock('../src/lifecycle', () => ({ isShuttingDown: lifecycle.isShuttingDown }));

import {
  DistributedJobLease,
  stopJobLeaseRenewals,
  type JobName,
} from '../src/services/distributedJobLease';

type Entry = { token: string; expiresAt: number };

function createFakeRedis() {
  const entries = new Map<string, Entry>();
  const current = (key: string): Entry | undefined => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };
  const set = vi.fn(async (key: string, token: string, ...args: (string | number)[]) => {
    if (args.includes('NX') && current(key)) return null;
    const px = args.indexOf('PX');
    entries.set(key, { token, expiresAt: Date.now() + Number(args[px + 1]) });
    return 'OK';
  });
  const evalCommand = vi.fn(
    async (script: string, _keyCount: number, key: string, token: string, duration?: number) => {
      const entry = current(key);
      if (!entry || entry.token !== token) return 0;
      if (script.includes('PEXPIRE')) {
        entry.expiresAt = Date.now() + Number(duration);
      } else {
        entries.delete(key);
      }
      return 1;
    }
  );
  const client = { eval: evalCommand, set } as unknown as RedisClient;
  const operation = async <T>(callback: (redis: RedisClient) => Promise<T>): Promise<T> =>
    callback(client);

  return {
    entries,
    evalCommand,
    operation,
    replace(job: JobName, token: string, durationMs: number) {
      entries.set(`jobs:lease:${job}`, { token, expiresAt: Date.now() + durationMs });
    },
    ttl(job: JobName) {
      return Math.max(-2, (current(`jobs:lease:${job}`)?.expiresAt ?? 0) - Date.now());
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-03T00:00:00.000Z'));
  logger.warn.mockClear();
  lifecycle.isShuttingDown.mockReset().mockReturnValue(false);
});

afterEach(() => {
  stopJobLeaseRenewals();
  vi.useRealTimers();
});

describe('distributed job leases', () => {
  it('allows one replica per job while independent jobs remain available', async () => {
    const fake = createFakeRedis();
    const replicaA = new DistributedJobLease(fake.operation, false);
    const replicaB = new DistributedJobLease(fake.operation, false);

    const contenders = await Promise.all([
      replicaA.acquireJobLease('summarization', 1_000),
      replicaB.acquireJobLease('summarization', 1_000),
    ]);
    expect(contenders.filter(Boolean)).toHaveLength(1);
    expect(await replicaB.acquireJobLease('state-expiry', 1_000)).not.toBeNull();
    expect([...fake.entries.keys()].sort()).toEqual([
      'jobs:lease:state-expiry',
      'jobs:lease:summarization',
    ]);
  });

  it('prevents an expired owner from renewing or releasing a newer lease', async () => {
    const fake = createFakeRedis();
    const oldReplica = new DistributedJobLease(fake.operation, false);
    const newReplica = new DistributedJobLease(fake.operation, false);
    const oldLease = await oldReplica.acquireJobLease('summarization', 90);
    expect(oldLease).not.toBeNull();

    vi.advanceTimersByTime(91);
    const newLease = await newReplica.acquireJobLease('summarization', 90);
    expect(newLease).not.toBeNull();
    expect(await oldReplica.renewJobLease(oldLease!)).toBe(false);
    expect(await oldReplica.releaseJobLease(oldLease!)).toBe(false);

    vi.advanceTimersByTime(30);
    expect(await newReplica.renewJobLease(newLease!)).toBe(true);
    expect(fake.ttl('summarization')).toBe(90);
    expect(await newReplica.releaseJobLease(newLease!)).toBe(true);
    expect(fake.ttl('summarization')).toBe(-2);
  });

  it('renews long work, excludes another replica, and releases on completion', async () => {
    const fake = createFakeRedis();
    const replicaA = new DistributedJobLease(fake.operation, false);
    const replicaB = new DistributedJobLease(fake.operation, false);
    const finish = deferred();
    const started = deferred();
    let stillOwner!: () => boolean;

    const running = replicaA.runJob(
      'summarization',
      async check => {
        stillOwner = check;
        started.resolve();
        await finish.promise;
      },
      90
    );
    await started.promise;

    const competingWork = vi.fn();
    await expect(
      replicaB.runJob('summarization', async () => competingWork(), 90)
    ).resolves.toBe(false);
    expect(competingWork).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(31);
    expect(stillOwner()).toBe(true);
    expect(fake.ttl('summarization')).toBeGreaterThan(80);

    finish.resolve();
    await expect(running).resolves.toBe(true);
    expect(fake.ttl('summarization')).toBe(-2);
  });

  it('releases after job exceptions', async () => {
    const fake = createFakeRedis();
    const lease = new DistributedJobLease(fake.operation, false);

    await expect(
      lease.runJob('state-expiry', async () => {
        throw new Error('job failed');
      })
    ).rejects.toThrow('job failed');
    expect(fake.ttl('state-expiry')).toBe(-2);
  });

  it('detects ownership loss and stops renewal during shutdown', async () => {
    const fake = createFakeRedis();
    const lease = new DistributedJobLease(fake.operation, false);
    const finish = deferred();
    const started = deferred();
    let stillOwner!: () => boolean;

    const running = lease.runJob(
      'summarization',
      async check => {
        stillOwner = check;
        started.resolve();
        await finish.promise;
      },
      90
    );
    await started.promise;
    fake.replace('summarization', 'new-owner', 90);
    await vi.advanceTimersByTimeAsync(31);

    expect(stillOwner()).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('Distributed job ownership lost', {
      event: 'distributed_job',
      job: 'summarization',
      outcome: 'ownership_lost',
      errorCategory: 'lease_mismatch',
    });
    stopJobLeaseRenewals();
    finish.resolve();
    await running;
  });

  it('stops active renewal and attempts one release during shutdown', async () => {
    const fake = createFakeRedis();
    const lease = new DistributedJobLease(fake.operation, false);
    const finish = deferred();
    const started = deferred();
    let stillOwner!: () => boolean;

    const running = lease.runJob(
      'state-expiry',
      async check => {
        stillOwner = check;
        started.resolve();
        await finish.promise;
      },
      90
    );
    await started.promise;
    stopJobLeaseRenewals();
    await vi.advanceTimersByTimeAsync(100);

    expect(stillOwner()).toBe(false);
    expect(fake.evalCommand).not.toHaveBeenCalled();
    finish.resolve();
    await running;
    expect(fake.evalCommand).toHaveBeenCalledOnce();
    expect(fake.ttl('state-expiry')).toBe(-2);
  });

  it('releases ownership acquired while shutdown begins without running work', async () => {
    const fake = createFakeRedis();
    const lease = new DistributedJobLease(fake.operation, false);
    const work = vi.fn();
    lifecycle.isShuttingDown.mockReturnValueOnce(false).mockReturnValue(true);

    await expect(lease.runJob('state-expiry', async () => work())).resolves.toBe(false);
    expect(work).not.toHaveBeenCalled();
    expect(fake.evalCommand).toHaveBeenCalledOnce();
    expect(fake.ttl('state-expiry')).toBe(-2);
  });

  it('fails closed in production and retains explicit local fallback', async () => {
    const unavailable = vi.fn(async <T>(callback: (redis: RedisClient) => Promise<T>) => {
      void callback;
      throw new RedisUnavailableError();
    });
    const production = new DistributedJobLease(unavailable, false);
    const work = vi.fn();

    await expect(production.runJob('idempotency-cleanup', async () => work())).resolves.toBe(false);
    await expect(production.runJob('idempotency-cleanup', async () => work())).resolves.toBe(false);
    expect(work).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();

    const localOperation = vi.fn(unavailable);
    const local = new DistributedJobLease(localOperation, true);
    await expect(local.runJob('idempotency-cleanup', async () => work())).resolves.toBe(true);
    expect(work).toHaveBeenCalledOnce();
    expect(localOperation).not.toHaveBeenCalled();
  });
});
