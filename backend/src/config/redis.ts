import logger from './logger';

let redisClient: any = null;
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

  async set(key: string, value: string, ...args: any[]): Promise<string | null> {
    let expireAt: number | undefined;
    const exIdx = args.indexOf('EX');
    if (exIdx !== -1 && args[exIdx + 1] != null) {
      expireAt = Date.now() + Number(args[exIdx + 1]) * 1000;
    }
    const nxMode = args.includes('NX');
    if (nxMode && this.store.has(key)) {
      const existing = this.store.get(key)!;
      if (!existing.expireAt || Date.now() < existing.expireAt) return null;
    }
    this.store.set(key, { value, expireAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

export function getRedisClient(): any {
  if (redisClient) return redisClient;

  try {
    const Redis = require('ioredis');
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          logger.warn('Redis unavailable after retries, falling back to in-memory state');
          redisClient = new InMemoryRedis();
          usingFallback = true;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      connectTimeout: 3000,
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', () => {
      if (!usingFallback) {
        logger.warn('Redis unavailable, using in-memory fallback for conversation state');
        redisClient = new InMemoryRedis();
        usingFallback = true;
      }
    });

    redisClient.connect().catch(() => {
      logger.warn('Redis not available, using in-memory fallback for conversation state');
      redisClient = new InMemoryRedis();
      usingFallback = true;
    });
  } catch {
    logger.warn('ioredis not installed, using in-memory fallback for conversation state');
    redisClient = new InMemoryRedis();
    usingFallback = true;
  }

  return redisClient;
}

export default getRedisClient;
