import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => {
  const redisPing = vi.fn();

  return {
    databaseQuery: vi.fn(),
    redisPing,
    getRedisClient: vi.fn(() => ({ ping: redisPing })),
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('../src/config/database', () => ({
  default: { $queryRaw: mocks.databaseQuery },
}));

vi.mock('../src/config/redis', () => ({
  default: mocks.getRedisClient,
  getRedisClient: mocks.getRedisClient,
}));

vi.mock('../src/config/logger', () => ({ default: mocks.logger }));

import app from '../src/index';
import { config } from '../src/config/env';
import { beginShutdown } from '../src/lifecycle';

const originalNodeEnv = config.NODE_ENV;

describe('health probes', () => {
  beforeEach(() => {
    config.NODE_ENV = originalNodeEnv;
    mocks.databaseQuery.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    mocks.redisPing.mockReset().mockResolvedValue('PONG');
    mocks.getRedisClient.mockReset().mockReturnValue({ ping: mocks.redisPing });
    mocks.logger.warn.mockClear();
  });

  afterEach(() => {
    config.NODE_ENV = originalNodeEnv;
  });

  it('reports liveness without checking dependencies or requiring middleware state', async () => {
    const response = await request(app).get('/livez').expect(200);

    expect(response.body).toEqual({ status: 'alive' });
    expect(response.headers['x-csrf-token']).toBeUndefined();
    expect(response.headers['ratelimit-limit']).toBeUndefined();
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
    expect(mocks.getRedisClient).not.toHaveBeenCalled();
    expect(mocks.logger.info).not.toHaveBeenCalledWith('Request processed', expect.anything());
  });

  it('reports ready when PostgreSQL and Redis are healthy', async () => {
    const response = await request(app).get('/readyz').expect(200);

    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: 'up', redis: 'up' },
    });
    expect(mocks.databaseQuery).toHaveBeenCalledOnce();
    expect(mocks.getRedisClient).toHaveBeenCalledOnce();
    expect(mocks.redisPing).toHaveBeenCalledOnce();
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it('reports not ready without exposing a PostgreSQL error', async () => {
    const sensitiveError = 'database failed at postgresql://user:password@private-host/database';
    mocks.databaseQuery.mockRejectedValue(new Error(sensitiveError));

    const response = await request(app).get('/readyz').expect(503);
    await request(app).get('/readyz').expect(503);

    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { database: 'down', redis: 'up' },
    });
    expect(JSON.stringify(response.body)).not.toContain(sensitiveError);
    expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain(sensitiveError);
    expect(mocks.logger.warn).toHaveBeenCalledWith('Readiness dependency unavailable', {
      event: 'readiness_check',
      dependency: 'database',
      outcome: 'down',
      errorCategory: 'unavailable',
    });
    expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('requires a real Redis connection in production', async () => {
    config.NODE_ENV = 'production';
    mocks.getRedisClient.mockReturnValue({});

    const response = await request(app).get('/readyz').expect(503);

    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { database: 'up', redis: 'down' },
    });
  });

  it('preserves the existing Redis fallback semantics outside production', async () => {
    config.NODE_ENV = 'test';
    mocks.getRedisClient.mockReturnValue({});

    const response = await request(app).get('/readyz').expect(200);

    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('bounds dependency checks that do not settle', async () => {
    mocks.databaseQuery.mockReturnValue(new Promise(() => undefined));
    mocks.redisPing.mockReturnValue(new Promise(() => undefined));
    const startedAt = Date.now();

    const response = await request(app).get('/readyz').expect(503);

    expect(Date.now() - startedAt).toBeLessThan(2500);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { database: 'down', redis: 'down' },
    });
  });

  it('never applies application rate limiting to repeated probes', async () => {
    const responses = await Promise.all([
      ...Array.from({ length: 110 }, () => request(app).get('/livez')),
      ...Array.from({ length: 110 }, () => request(app).get('/readyz')),
    ]);

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => response.headers['ratelimit-limit'] === undefined)).toBe(true);
  });

  it('becomes not ready immediately during shutdown while remaining live', async () => {
    expect(beginShutdown()).toBe(true);

    const readiness = await request(app).get('/readyz').expect(503);
    const liveness = await request(app).get('/livez').expect(200);

    expect(readiness.body).toEqual({
      status: 'not_ready',
      reason: 'shutting_down',
      checks: { database: 'up', redis: 'up' },
    });
    expect(liveness.body).toEqual({ status: 'alive' });
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
    expect(mocks.getRedisClient).not.toHaveBeenCalled();
  });
});
