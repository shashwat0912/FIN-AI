import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RedisHandler = () => void;
type FakeRedisClient = {
  handlers: Map<string, RedisHandler>;
  connect: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const clients: FakeRedisClient[] = [];
  const RedisConstructor = vi.fn(function RedisMock() {
    const handlers = new Map<string, RedisHandler>();
    const client: FakeRedisClient = {
      handlers,
      connect: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      on: vi.fn((event: string, handler: RedisHandler) => {
        handlers.set(event, handler);
        return client;
      }),
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      set: vi.fn().mockResolvedValue('OK'),
    };
    clients.push(client);
    return client;
  });

  return {
    clients,
    RedisConstructor,
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('ioredis', () => ({ default: mocks.RedisConstructor }));
vi.mock('../src/config/logger', () => ({ default: mocks.logger }));

const originalNodeEnv = process.env.NODE_ENV;
const originalRedisUrl = process.env.REDIS_URL;

async function loadRedis(environment: 'development' | 'test' | 'production', redisUrl?: string) {
  vi.resetModules();
  process.env.NODE_ENV = 'test';
  if (redisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = redisUrl;

  const { config } = await import('../src/config/env');
  config.NODE_ENV = environment;
  if (redisUrl === undefined) delete process.env.REDIS_URL;

  return {
    config,
    redis: await import('../src/config/redis'),
  };
}

beforeEach(() => {
  mocks.clients.length = 0;
  mocks.RedisConstructor.mockClear();
  mocks.logger.error.mockClear();
  mocks.logger.info.mockClear();
  mocks.logger.warn.mockClear();
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

describe('Redis runtime safety', () => {
  it('reports connecting, connected, unavailable, and recovered real Redis states', async () => {
    const { redis } = await loadRedis('production', 'redis://configured-host:6379');

    expect(redis.getRedisState()).toBe('unavailable');
    redis.getRedisClient();
    expect(redis.getRedisState()).toBe('connecting');
    expect(redis.isRedisReady()).toBe(false);

    const client = mocks.clients[0];
    client.handlers.get('ready')?.();
    expect(redis.getRedisState()).toBe('connected');
    expect(redis.isRedisReady()).toBe(true);

    client.handlers.get('error')?.();
    expect(redis.getRedisState()).toBe('unavailable');
    expect(redis.isRedisReady()).toBe(false);

    client.handlers.get('ready')?.();
    expect(redis.getRedisState()).toBe('connected');
    expect(mocks.RedisConstructor).toHaveBeenCalledOnce();
  });

  it('uses an explicit accepted fallback in test and closes its abandoned connection harmlessly', async () => {
    const { redis } = await loadRedis('test', 'redis://configured-host:6379');
    redis.getRedisClient();
    const client = mocks.clients[0];

    client.handlers.get('error')?.();
    expect(redis.getRedisState()).toBe('fallback');
    expect(redis.isRedisReady()).toBe(true);

    const { ConversationStateMachine } = await import(
      '../src/services/chat/conversationStateMachine'
    );
    await expect(new ConversationStateMachine().getState('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      state: 'IDLE',
    });

    await redis.closeRedisConnection();
    expect(redis.getRedisState()).toBe('shutting_down');
    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.quit).not.toHaveBeenCalled();
  });

  it('never accepts a pod-local fallback after switching to production semantics', async () => {
    const { config, redis } = await loadRedis('test', 'redis://configured-host:6379');
    redis.getRedisClient();
    mocks.clients[0].handlers.get('error')?.();
    expect(redis.getRedisState()).toBe('fallback');

    config.NODE_ENV = 'production';

    expect(redis.isRedisReady()).toBe(false);
    expect(() => redis.getRedisClient()).toThrowError(redis.RedisUnavailableError);
  });

  it('fails a production Redis-dependent operation with a safe controlled error', async () => {
    const sensitiveError = 'WRONGPASS redis://user:password@private-host:6379';
    const { redis } = await loadRedis('production', 'redis://configured-host:6379');
    redis.getRedisClient();
    const client = mocks.clients[0];
    client.handlers.get('ready')?.();
    client.get.mockRejectedValue(new Error(sensitiveError));
    const { ConversationStateMachine } = await import(
      '../src/services/chat/conversationStateMachine'
    );

    await expect(new ConversationStateMachine().getState('user-1')).rejects.toMatchObject({
      name: 'RedisUnavailableError',
      statusCode: 503,
      message: 'Shared state service is temporarily unavailable',
    });
    expect(redis.getRedisState()).toBe('unavailable');
    expect(JSON.stringify(mocks.logger.warn.mock.calls)).not.toContain(sensitiveError);
  });

  it('keeps production unavailable when Redis configuration is missing without constructing a client', async () => {
    const { redis } = await loadRedis('production');

    expect(() => redis.getRedisClient()).toThrowError(redis.RedisUnavailableError);
    expect(() => redis.getRedisClient()).toThrowError(redis.RedisUnavailableError);
    expect(redis.getRedisState()).toBe('unavailable');
    expect(mocks.RedisConstructor).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalledOnce();
  });

  it('closes one existing real connection once and never constructs during shutdown', async () => {
    const { redis } = await loadRedis('production', 'redis://configured-host:6379');
    redis.getRedisClient();
    const client = mocks.clients[0];
    client.handlers.get('ready')?.();

    const firstClose = redis.closeRedisConnection();
    const repeatedClose = redis.closeRedisConnection();

    expect(repeatedClose).toBe(firstClose);
    await firstClose;
    expect(redis.getRedisState()).toBe('shutting_down');
    expect(client.quit).toHaveBeenCalledOnce();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(() => redis.getRedisClient()).toThrowError(redis.RedisUnavailableError);
    expect(mocks.RedisConstructor).toHaveBeenCalledOnce();
  });
});

describe('Prisma singleton safety', () => {
  it('shares one Prisma client across the database module and application controllers', async () => {
    vi.resetModules();
    globalThis.__prisma = undefined;
    const sharedClient = {
      $disconnect: vi.fn().mockResolvedValue(undefined),
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const PrismaClient = vi.fn(function PrismaClientMock() {
      return sharedClient;
    });
    vi.doMock('@prisma/client', () => ({ PrismaClient }));

    const [
      { default: prisma },
      { UserController },
      { GoalController },
      { createShutdownCoordinator },
    ] = await Promise.all([
      import('../src/config/database'),
      import('../src/controllers/userController'),
      import('../src/controllers/goalController'),
      import('../src/shutdown'),
    ]);

    const userController = new UserController();
    new UserController();
    new GoalController();
    new GoalController();
    const request = { user: { id: 'user-1' } } as unknown as Parameters<
      typeof userController.getProfile
    >[0];
    const response = {} as Parameters<typeof userController.getProfile>[1];
    await userController.getProfile(request, response);
    await userController.getProfile(request, response);

    const shutdown = createShutdownCoordinator({
      server: { close: (callback: () => void) => callback() },
      jobs: [],
      disconnectPrisma: () => sharedClient.$disconnect(),
      shutdownRedis: vi.fn().mockResolvedValue(undefined),
      exit: vi.fn(),
      log: { error: vi.fn(), info: vi.fn() },
    });
    const firstShutdown = shutdown('SIGTERM');
    const repeatedShutdown = shutdown('SIGINT');
    await firstShutdown;

    expect(prisma).toBe(sharedClient);
    expect(PrismaClient).toHaveBeenCalledOnce();
    expect(sharedClient.user.findUnique).toHaveBeenCalledTimes(2);
    expect(repeatedShutdown).toBe(firstShutdown);
    expect(sharedClient.$disconnect).toHaveBeenCalledOnce();
    globalThis.__prisma = undefined;
    vi.doUnmock('@prisma/client');
  });
});
