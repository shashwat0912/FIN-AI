import type { NextFunction, Request, Response } from 'express';
import { rateLimit, type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisUnavailableError, type RedisClient } from '../../src/config/redis';
import {
  createRateLimitStore,
  rateLimitKey,
  SecurityStateService,
} from '../../src/services/securityStateService';

type ExpiringCount = { count: number; expiresAt: number };

function createFakeRedis() {
  const attempts = new Map<string, ExpiringCount>();
  const locks = new Map<string, number>();
  const rateLimits = new Map<string, ExpiringCount>();
  const scripts = new Map<string, string>();

  const del = vi.fn(async (...keys: string[]) => {
    let deleted = 0;
    for (const key of keys) {
      if (attempts.delete(key) || locks.delete(key) || rateLimits.delete(key)) deleted += 1;
    }
    return deleted;
  });

  const evalCommand = vi.fn(async (...args: unknown[]) => {
    const attemptsKey = String(args[2]);
    const lockoutKey = String(args[3]);
    const maxAttempts = Number(args[4]);
    const lockoutMs = Number(args[5]);
    const lockoutUntil = locks.get(lockoutKey) ?? 0;
    if (lockoutUntil > Date.now()) return [maxAttempts, lockoutUntil - Date.now()];

    const current = attempts.get(attemptsKey);
    const count = current && current.expiresAt > Date.now() ? current.count + 1 : 1;
    attempts.set(attemptsKey, { count, expiresAt: Date.now() + lockoutMs });
    if (count >= maxAttempts) {
      attempts.delete(attemptsKey);
      locks.set(lockoutKey, Date.now() + lockoutMs);
      return [count, lockoutMs];
    }
    return [count, 0];
  });

  const call = vi.fn(async (command: string, ...args: string[]) => {
    switch (command.toUpperCase()) {
      case 'SCRIPT': {
        const sha = `script-${scripts.size + 1}`;
        scripts.set(sha, args[1]);
        return sha;
      }
      case 'EVALSHA': {
        const script = scripts.get(args[0]) ?? '';
        const key = args[2];
        const current = rateLimits.get(key);
        const active = current && current.expiresAt > Date.now() ? current : undefined;
        if (!script.includes('INCR')) {
          return active ? [active.count, active.expiresAt - Date.now()] : [false, -2];
        }
        const windowMs = Number(args[4]);
        const next = {
          count: (active?.count ?? 0) + 1,
          expiresAt: active?.expiresAt ?? Date.now() + windowMs,
        };
        rateLimits.set(key, next);
        return [next.count, next.expiresAt - Date.now()];
      }
      case 'DECR': {
        const current = rateLimits.get(args[0]);
        if (current) current.count -= 1;
        return current?.count ?? 0;
      }
      case 'DEL':
        return del(...args);
      default:
        throw new Error('Unsupported fake Redis command');
    }
  });

  const client = {
    call,
    del,
    eval: evalCommand,
    pttl: vi.fn(async (key: string) => Math.max(-2, (locks.get(key) ?? 0) - Date.now())),
  } as unknown as RedisClient;
  const operation = async <T>(callback: (redis: RedisClient) => Promise<T>): Promise<T> =>
    callback(client);

  return { attempts, call, evalCommand, locks, operation, rateLimits };
}

async function runLimiter(limiter: RateLimitRequestHandler, key: string) {
  let nextCalled = false;
  let status = 200;
  const request = { method: 'GET', path: '/', rateLimitKey: key } as Request & {
    rateLimitKey: string;
  };
  const response = {
    json() {
      return response;
    },
    setHeader() {},
    status(code: number) {
      status = code;
      return response;
    },
  } as unknown as Response;
  await limiter(request, response, (() => {
    nextCalled = true;
  }) as NextFunction);
  return { nextCalled, status };
}

describe('shared security state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares atomic login failures across replicas, applies TTL, and clears on success', async () => {
    const fake = createFakeRedis();
    const replicaA = new SecurityStateService(fake.operation, false);
    const replicaB = new SecurityStateService(fake.operation, false);
    const identifier = '203.0.113.7:person@example.com';

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        (index % 2 === 0 ? replicaA : replicaB).incrementLoginFailure(identifier, 5, 60_000)
      )
    );

    expect(results.map(result => result.count).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(await replicaA.getLoginLockout(identifier)).toBe(60_000);
    vi.advanceTimersByTime(1_000);
    expect(await replicaB.getLoginLockout(identifier)).toBe(59_000);

    const redisKeys = fake.evalCommand.mock.calls.flatMap(callArgs => callArgs.slice(2, 4));
    expect(redisKeys.every(key => !String(key).includes('person@example.com'))).toBe(true);
    expect(redisKeys.every(key => !String(key).includes('203.0.113.7'))).toBe(true);

    await replicaB.clearLoginFailures(identifier);
    expect(await replicaA.getLoginLockout(identifier)).toBe(0);
  });

  it('shares rate limits across replicas, expires counters, and isolates prefixes', async () => {
    const fake = createFakeRedis();
    const sharedLimiterA = rateLimit({
      store: createRateLimitStore('shared-api', true, fake.operation),
      keyGenerator: req => (req as Request & { rateLimitKey: string }).rateLimitKey,
      windowMs: 1_000,
      max: 2,
      standardHeaders: false,
      legacyHeaders: false,
      handler: (_req, res) => res.status(429).json({ success: false }),
    });
    const sharedLimiterB = rateLimit({
      store: createRateLimitStore('shared-api', true, fake.operation),
      keyGenerator: req => (req as Request & { rateLimitKey: string }).rateLimitKey,
      windowMs: 1_000,
      max: 2,
      standardHeaders: false,
      legacyHeaders: false,
      handler: (_req, res) => res.status(429).json({ success: false }),
    });
    await expect(runLimiter(sharedLimiterA, 'shared-key')).resolves.toEqual({
      nextCalled: true,
      status: 200,
    });
    await expect(runLimiter(sharedLimiterB, 'shared-key')).resolves.toEqual({
      nextCalled: true,
      status: 200,
    });
    await expect(runLimiter(sharedLimiterA, 'shared-key')).resolves.toEqual({
      nextCalled: false,
      status: 429,
    });

    const replicaA = createRateLimitStore('chat-message', true, fake.operation);
    const replicaB = createRateLimitStore('chat-message', true, fake.operation);
    const otherCategory = createRateLimitStore('auth-route', true, fake.operation);
    const options = { windowMs: 1_000 } as Options;
    replicaA?.init?.(options);
    replicaB?.init?.(options);
    otherCategory?.init?.(options);
    const key = rateLimitKey({ ip: '203.0.113.9' } as Request);

    expect((await replicaA?.increment(key))?.totalHits).toBe(1);
    expect((await replicaB?.increment(key))?.totalHits).toBe(2);
    expect((await otherCategory?.increment(key))?.totalHits).toBe(1);
    expect([...fake.rateLimits.keys()].every(redisKey => !redisKey.includes('203.0.113.9'))).toBe(
      true
    );

    vi.advanceTimersByTime(1_001);
    expect((await replicaA?.increment(key))?.totalHits).toBe(1);
  });

  it('fails closed on production Redis errors and retains explicit local test fallback', async () => {
    const unavailable = async <T>(callback: (redis: RedisClient) => Promise<T>): Promise<T> => {
      void callback;
      throw new RedisUnavailableError();
    };
    const production = new SecurityStateService(unavailable, false);
    const productionStore = createRateLimitStore('failure-test', true, unavailable);
    productionStore?.init?.({ windowMs: 1_000 } as Options);

    await expect(production.getLoginLockout('person@example.com')).rejects.toMatchObject({
      name: 'RedisUnavailableError',
      statusCode: 503,
    });
    await expect(productionStore?.increment('safe-key')).rejects.toMatchObject({
      name: 'RedisUnavailableError',
      statusCode: 503,
    });

    const localOperation = vi.fn(unavailable);
    const local = new SecurityStateService(localOperation, true);
    await expect(local.incrementLoginFailure('local-user', 2, 1_000)).resolves.toMatchObject({
      count: 1,
    });
    expect(localOperation).not.toHaveBeenCalled();
    expect(createRateLimitStore('local-test', false, localOperation)).toBeUndefined();
  });
});
