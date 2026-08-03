import Redis from 'ioredis';
import logger from './logger';

let redisClient: Redis | InMemoryRedis | null = null;
let redisConnection: Redis | null = null;
let usingFallback = false;

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

export function getRedisClient(): Redis | InMemoryRedis {
  if (redisClient) return redisClient;

  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          logger.warn('Redis unavailable after retries, falling back to in-memory state');
          if (redisClient === client) {
            redisClient = new InMemoryRedis();
            usingFallback = true;
          }
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      connectTimeout: 3000,
    });
    redisClient = client;
    redisConnection = client;

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', () => {
      if (!usingFallback && redisClient === client) {
        logger.warn('Redis unavailable, using in-memory fallback for conversation state');
        redisClient = new InMemoryRedis();
        usingFallback = true;
      }
    });

    client.connect().catch(() => {
      if (redisClient === client) {
        logger.warn('Redis not available, using in-memory fallback for conversation state');
        redisClient = new InMemoryRedis();
        usingFallback = true;
      }
    });
  } catch {
    logger.warn('ioredis not installed, using in-memory fallback for conversation state');
    redisClient = new InMemoryRedis();
    usingFallback = true;
  }

  return redisClient;
}

export async function shutdownRedis(): Promise<void> {
  const connection = redisConnection;
  const fallback = usingFallback;
  redisClient = null;
  redisConnection = null;
  usingFallback = false;
  if (!connection) return;

  if (fallback) {
    try {
      connection.disconnect();
    } catch {
      // The fallback is already independent of the abandoned real connection.
    }
    return;
  }

  await connection.quit();
}

export default getRedisClient;
