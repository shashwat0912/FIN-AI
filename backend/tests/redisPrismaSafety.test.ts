import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RedisHandler = (...args: unknown[]) => void;
type FakeRedisClient = {
  baseConnect: ReturnType<typeof vi.fn>;
  connectPasswords: unknown[];
  handlers: Map<string, RedisHandler>;
  connect: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  options: Record<string, unknown>;
  ping: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const clients: FakeRedisClient[] = [];
  const RedisConstructor = vi.fn(function RedisMock(
    connection: string | Record<string, unknown>,
    redisOptions?: Record<string, unknown>
  ) {
    const handlers = new Map<string, RedisHandler>();
    const connectPasswords: unknown[] = [];
    const client = {} as FakeRedisClient;
    const baseConnect = vi.fn(async () => {
      connectPasswords.push(client.options.password);
    });
    Object.assign(client, {
      baseConnect,
      connectPasswords,
      handlers,
      connect: baseConnect,
      del: vi.fn().mockResolvedValue(1),
      disconnect: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      on: vi.fn((event: string, handler: RedisHandler) => {
        handlers.set(event, handler);
        return client;
      }),
      options: typeof connection === 'string' ? (redisOptions ?? {}) : connection,
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
      set: vi.fn().mockResolvedValue('OK'),
    });
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
    createElastiCacheIamToken: vi.fn(),
  };
});

vi.mock('ioredis', () => ({ default: mocks.RedisConstructor }));
vi.mock('../src/config/logger', () => ({ default: mocks.logger }));
vi.mock('../src/config/elasticacheIamAuth', () => ({
  createElastiCacheIamToken: mocks.createElastiCacheIamToken,
}));

const originalNodeEnv = process.env.NODE_ENV;
const redisEnvNames = [
  'REDIS_AUTH_MODE',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_USERNAME',
  'REDIS_IAM_CACHE_NAME',
  'AWS_REGION',
] as const;
const originalRedisEnv = Object.fromEntries(redisEnvNames.map(name => [name, process.env[name]]));

type RedisEnvironment = Partial<Record<(typeof redisEnvNames)[number], string>>;

const iamEnvironment: RedisEnvironment = {
  REDIS_AUTH_MODE: 'iam',
  REDIS_HOST: 'finance-ai.cache.amazonaws.com',
  REDIS_PORT: '6379',
  REDIS_USERNAME: 'finance-ai-staging-valkey-app',
  REDIS_IAM_CACHE_NAME: 'finance-ai-staging-valkey',
  AWS_REGION: 'ap-south-1',
};

async function loadRedis(
  environment: 'development' | 'test' | 'production',
  redisEnvironment: RedisEnvironment = {}
) {
  vi.resetModules();
  process.env.NODE_ENV = 'test';
  for (const name of redisEnvNames) delete process.env[name];
  for (const [name, value] of Object.entries(redisEnvironment)) {
    if (value !== undefined) process.env[name] = value;
  }

  const { config } = await import('../src/config/env');
  config.NODE_ENV = environment;
  for (const name of redisEnvNames) {
    if (redisEnvironment[name] === undefined) delete process.env[name];
  }

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
  mocks.createElastiCacheIamToken.mockReset().mockResolvedValue('iam-token');
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  for (const name of redisEnvNames) {
    const value = originalRedisEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('Redis runtime safety', () => {
  it('reports connecting, connected, unavailable, and recovered real Redis states', async () => {
    const { redis } = await loadRedis('production', {
      REDIS_AUTH_MODE: 'url',
      REDIS_URL: 'redis://configured-host:6379',
    });

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
    expect(mocks.RedisConstructor).toHaveBeenCalledWith(
      'redis://configured-host:6379',
      expect.not.objectContaining({ tls: expect.anything() })
    );
  });

  it('connects IAM mode with verified TLS, the configured username, and a generated password', async () => {
    const { redis } = await loadRedis('production', iamEnvironment);

    redis.getRedisClient();
    const client = mocks.clients[0];
    await client.connect();

    expect(mocks.RedisConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        host: iamEnvironment.REDIS_HOST,
        port: 6379,
        username: iamEnvironment.REDIS_USERNAME,
        tls: { servername: iamEnvironment.REDIS_HOST },
      })
    );
    expect(client.options.password).toBe('iam-token');
    expect(client.connectPasswords).toEqual(['iam-token']);
    expect(client.options.tls).not.toHaveProperty('rejectUnauthorized');
    expect(mocks.createElastiCacheIamToken).toHaveBeenCalledWith({
      cacheName: iamEnvironment.REDIS_IAM_CACHE_NAME,
      region: iamEnvironment.AWS_REGION,
      username: iamEnvironment.REDIS_USERNAME,
    });
  });

  it('gets a fresh IAM token before every ioredis reconnect', async () => {
    mocks.createElastiCacheIamToken
      .mockResolvedValueOnce('first-iam-token')
      .mockResolvedValueOnce('second-iam-token');
    const { redis } = await loadRedis('production', iamEnvironment);

    redis.getRedisClient();
    const client = mocks.clients[0];
    await client.connect();
    expect(client.options.password).toBe('first-iam-token');

    client.handlers.get('reconnecting')?.(200);
    expect(redis.getRedisState()).toBe('unavailable');
    await client.connect();
    expect(client.options.password).toBe('second-iam-token');
    expect(client.connectPasswords).toEqual(['first-iam-token', 'second-iam-token']);
    expect(mocks.createElastiCacheIamToken).toHaveBeenCalledTimes(2);
    expect(client.baseConnect).toHaveBeenCalledTimes(2);
  });

  it('never logs IAM tokens, AWS credential material, or credential-bearing URLs', async () => {
    const sensitiveValues = [
      'iam-token-do-not-log',
      'aws-secret-access-key-do-not-log',
      'redis://user:password@private-host:6379',
    ];
    mocks.createElastiCacheIamToken.mockResolvedValue(sensitiveValues[0]);
    const { redis } = await loadRedis('production', iamEnvironment);

    redis.getRedisClient();
    const client = mocks.clients[0];
    await client.connect();
    client.handlers.get('error')?.(new Error(sensitiveValues.join(' ')));

    const logs = JSON.stringify({
      error: mocks.logger.error.mock.calls,
      info: mocks.logger.info.mock.calls,
      warn: mocks.logger.warn.mock.calls,
    });
    for (const sensitiveValue of sensitiveValues) expect(logs).not.toContain(sensitiveValue);
  });

  it('fails clearly when IAM configuration is incomplete or invalid', async () => {
    for (const name of [
      'REDIS_HOST',
      'REDIS_USERNAME',
      'REDIS_IAM_CACHE_NAME',
      'AWS_REGION',
    ] as const) {
      await expect(loadRedis('test', { ...iamEnvironment, [name]: '' })).rejects.toThrow(
        `${name} is required when REDIS_AUTH_MODE=iam`
      );
    }

    await expect(
      loadRedis('test', { ...iamEnvironment, REDIS_PORT: 'not-a-port' })
    ).rejects.toThrow('REDIS_PORT must be an integer between 1 and 65535');

    await expect(loadRedis('test', { REDIS_AUTH_MODE: 'automatic' })).rejects.toThrow(
      'REDIS_AUTH_MODE must be either "url" or "iam"'
    );
  });

  it('uses an explicit accepted fallback in test and closes its abandoned connection harmlessly', async () => {
    const { redis } = await loadRedis('test', { REDIS_URL: 'redis://configured-host:6379' });
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
    const { config, redis } = await loadRedis('test', {
      REDIS_URL: 'redis://configured-host:6379',
    });
    redis.getRedisClient();
    mocks.clients[0].handlers.get('error')?.();
    expect(redis.getRedisState()).toBe('fallback');

    config.NODE_ENV = 'production';

    expect(redis.isRedisReady()).toBe(false);
    expect(() => redis.getRedisClient()).toThrowError(redis.RedisUnavailableError);
  });

  it('fails a production Redis-dependent operation with a safe controlled error', async () => {
    const sensitiveError = 'WRONGPASS redis://user:password@private-host:6379';
    const { redis } = await loadRedis('production', {
      REDIS_URL: 'redis://configured-host:6379',
    });
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
    const { redis } = await loadRedis('production', {
      REDIS_URL: 'redis://configured-host:6379',
    });
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

  it('cancels an IAM connection that is still waiting for its first token during shutdown', async () => {
    let resolveToken!: (token: string) => void;
    mocks.createElastiCacheIamToken.mockReturnValue(
      new Promise<string>(resolve => {
        resolveToken = resolve;
      })
    );
    const { redis } = await loadRedis('production', iamEnvironment);

    redis.getRedisClient();
    const client = mocks.clients[0];
    await redis.closeRedisConnection();
    resolveToken('too-late-token');
    await Promise.resolve();

    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.quit).not.toHaveBeenCalled();
    expect(client.baseConnect).not.toHaveBeenCalled();
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
