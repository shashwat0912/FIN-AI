import Redis from 'ioredis';
import { config } from './env';
import logger from './logger';

export type RedisState = 'connected' | 'connecting' | 'unavailable' | 'fallback' | 'shutting_down';

export type RedisClient = Pick<Redis, 'get' | 'set' | 'del' | 'call' | 'eval' | 'pttl'>;

export class RedisUnavailableError extends Error {
  readonly statusCode = 503;

  constructor() {
    super('Shared state service is temporarily unavailable');
    this.name = 'RedisUnavailableError';
  }
}

let redisClient: Redis | InMemoryRedis | null = null;
let redisConnection: Redis | null = null;
let redisState: RedisState = 'unavailable';
let closePromise: Promise<void> | undefined;
let failureLogged = false;

class InMemoryRedis {
  private store = new Map<string, { value: string; expireAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && Date.now() > entry.expireAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<string | null> {
    let expireAt: number | undefined;
    const exIdx = args.indexOf('EX');
    if (exIdx !== -1 && args[exIdx + 1] != null) {
      expireAt = Date.now() + Number(args[exIdx + 1]) * 1000;
    }
    const nxMode = args.includes('NX');
    if (nxMode && this.store.has(key)) {
      const existing = this.store.get(key);
      if (existing && (!existing.expireAt || Date.now() < existing.expireAt)) return null;
    }
    this.store.set(key, { value, expireAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

function markUnavailable(connection?: Redis): void {
  if (redisState === 'shutting_down') return;
  if (connection && redisConnection !== connection) return;
  if (redisState === 'fallback') return;

  if (isProduction()) {
    redisState = 'unavailable';
    if (!failureLogged) {
      failureLogged = true;
      logger.warn('Redis unavailable', {
        event: 'redis_state_changed',
        outcome: 'unavailable',
        errorCategory: 'connection',
      });
    }
    return;
  }

  redisClient = new InMemoryRedis();
  redisState = 'fallback';
  if (!failureLogged) {
    failureLogged = true;
    logger.warn('Redis unavailable; using development/test in-memory fallback', {
      event: 'redis_state_changed',
      outcome: 'fallback',
      errorCategory: 'connection',
    });
  }
}

export function getRedisState(): RedisState {
  return redisState;
}

export function isRedisReady(): boolean {
  return redisState === 'connected' || (redisState === 'fallback' && !isProduction());
}

export function getRedisClient(): RedisClient {
  if (redisState === 'shutting_down') throw new RedisUnavailableError();
  if (redisClient) {
    if (isProduction() && redisState === 'unavailable') throw new RedisUnavailableError();
    if (isProduction() && redisState === 'fallback') throw new RedisUnavailableError();
    return redisClient as RedisClient;
  }

  const configuredUrl = process.env.REDIS_URL?.trim();
  if (isProduction() && !configuredUrl) {
    if (!failureLogged) {
      failureLogged = true;
      logger.warn('Redis configuration unavailable', {
        event: 'redis_state_changed',
        outcome: 'unavailable',
        errorCategory: 'configuration',
      });
    }
    throw new RedisUnavailableError();
  }

  try {
    const client = new Redis(configuredUrl || config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (!isProduction() && times > 3) {
          markUnavailable(client);
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      connectTimeout: 3000,
    });
    redisClient = client;
    redisConnection = client;
    redisState = 'connecting';

    client.on('ready', () => {
      if (redisClient === client && redisState !== 'shutting_down') {
        redisState = 'connected';
        failureLogged = false;
        logger.info('Redis connected', {
          event: 'redis_state_changed',
          outcome: 'connected',
        });
      }
    });
    client.on('error', () => markUnavailable(client));
    client.on('end', () => markUnavailable(client));
    client.connect().catch(() => markUnavailable(client));
  } catch {
    markUnavailable();
  }

  if (!redisClient || (isProduction() && redisState === 'unavailable')) {
    throw new RedisUnavailableError();
  }
  return redisClient as RedisClient;
}

function isControlledError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error;
}

export async function runRedisOperation<T>(
  operation: (client: RedisClient) => Promise<T>
): Promise<T> {
  const client = getRedisClient();
  try {
    return await operation(client);
  } catch (error: unknown) {
    if (isControlledError(error)) throw error;
    markUnavailable(redisConnection ?? undefined);

    if (redisState === 'fallback' && redisClient && !isProduction()) {
      try {
        return await operation(redisClient as RedisClient);
      } catch (retryError: unknown) {
        if (isControlledError(retryError)) throw retryError;
      }
    }

    throw new RedisUnavailableError();
  }
}

export async function pingRedis(): Promise<void> {
  getRedisClient();
  if (redisState === 'fallback' && !isProduction()) return;

  const connection = redisConnection;
  if (!connection) throw new RedisUnavailableError();

  try {
    await connection.ping();
    if (redisState !== 'shutting_down') redisState = 'connected';
  } catch {
    markUnavailable(connection);
    throw new RedisUnavailableError();
  }
}

export function closeRedisConnection(): Promise<void> {
  if (closePromise) return closePromise;

  const connection = redisConnection;
  const previousState = redisState;
  redisState = 'shutting_down';
  redisClient = null;
  redisConnection = null;

  closePromise = (async () => {
    if (!connection) return;

    if (previousState === 'fallback' || previousState === 'unavailable') {
      try {
        connection.disconnect();
      } catch {
        // The application no longer depends on this failed connection.
      }
      return;
    }

    await connection.quit();
  })();

  return closePromise;
}

export default getRedisClient;
