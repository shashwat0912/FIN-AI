import { createHmac } from 'crypto';
import type { Request } from 'express';
import type { Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { config } from '../config/env';
import { RedisUnavailableError, runRedisOperation, type RedisClient } from '../config/redis';
import type { AuthenticatedRequest } from '../types';

export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = config.NODE_ENV === 'development' ? 20 : 5;

type RedisOperation = <T>(operation: (client: RedisClient) => Promise<T>) => Promise<T>;
type LoginState = { count: number; lockoutUntil: number; expiresAt: number };

const localLoginState = new Map<string, LoginState>();
const incrementLoginFailureScript = `
local lockTtl = redis.call('PTTL', KEYS[2])
if lockTtl > 0 then return {tonumber(ARGV[1]), lockTtl} end
local count = redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
if count >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[2])
  return {count, tonumber(ARGV[2])}
end
return {count, 0}
`;

function digest(namespace: string, identifier: string): string {
  return createHmac('sha256', config.SECURITY_STATE_HMAC_SECRET)
    .update(`finance-ai:${namespace}:${identifier}`)
    .digest('hex');
}

function loginKeys(identifier: string): [string, string] {
  const id = digest('login', identifier);
  return [`security:login:{${id}}:attempts`, `security:login:{${id}}:lockout`];
}

function parseIncrementResult(result: unknown): { count: number; retryAfterMs: number } {
  if (!Array.isArray(result) || result.length !== 2) throw new RedisUnavailableError();
  const count = Number(result[0]);
  const retryAfterMs = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(retryAfterMs)) {
    throw new RedisUnavailableError();
  }
  return { count, retryAfterMs };
}

export function loginSecurityIdentifier(req: Request): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${req.ip || 'unknown'}:${email}`;
}

export function rateLimitKey(req: Request): string {
  const userId = (req as Partial<AuthenticatedRequest>).user?.id;
  return digest('rate-limit', userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`);
}

export function createRateLimitStore(
  category: string,
  useRedis = config.NODE_ENV === 'production',
  operation: RedisOperation = runRedisOperation
): Store | undefined {
  if (!useRedis) return undefined;

  const store = new RedisStore({
    prefix: `security:rate-limit:${category}:`,
    sendCommand: async (command: string, ...args: string[]) =>
      operation(async client => (await client.call(command, ...args)) as RedisReply),
  });
  // The adapter eagerly loads both scripts; mark both promises handled when Redis is unavailable.
  void store.incrementScriptSha.catch(() => undefined);
  void store.getScriptSha.catch(() => undefined);
  return store;
}

export class SecurityStateService {
  constructor(
    private readonly operation: RedisOperation = runRedisOperation,
    private readonly useLocalFallback = config.NODE_ENV !== 'production'
  ) {}

  async getLoginLockout(identifier: string): Promise<number> {
    const [attemptsKey, lockoutKey] = loginKeys(identifier);
    if (this.useLocalFallback) {
      const current = localLoginState.get(attemptsKey);
      if (!current || current.expiresAt <= Date.now()) {
        localLoginState.delete(attemptsKey);
        return 0;
      }
      return Math.max(0, current.lockoutUntil - Date.now());
    }

    const ttl = await this.operation(client => client.pttl(lockoutKey));
    return Math.max(0, ttl);
  }

  async incrementLoginFailure(
    identifier: string,
    maxAttempts = LOGIN_MAX_ATTEMPTS,
    lockoutMs = LOGIN_LOCKOUT_MS
  ): Promise<{ count: number; retryAfterMs: number }> {
    const [attemptsKey, lockoutKey] = loginKeys(identifier);
    if (this.useLocalFallback) {
      // ponytail: this fallback is single-process only; production always uses Redis.
      const now = Date.now();
      const current = localLoginState.get(attemptsKey);
      if (current && current.lockoutUntil > now) {
        return { count: current.count, retryAfterMs: current.lockoutUntil - now };
      }

      const count = current && current.expiresAt > now ? current.count + 1 : 1;
      const lockoutUntil = count >= maxAttempts ? now + lockoutMs : 0;
      localLoginState.set(attemptsKey, {
        count,
        lockoutUntil,
        expiresAt: now + lockoutMs,
      });
      return { count, retryAfterMs: Math.max(0, lockoutUntil - now) };
    }

    const result = await this.operation(client =>
      client.eval(incrementLoginFailureScript, 2, attemptsKey, lockoutKey, maxAttempts, lockoutMs)
    );
    return parseIncrementResult(result);
  }

  async clearLoginFailures(identifier: string): Promise<void> {
    const [attemptsKey, lockoutKey] = loginKeys(identifier);
    if (this.useLocalFallback) {
      localLoginState.delete(attemptsKey);
      return;
    }
    await this.operation(async client => {
      await client.del(attemptsKey, lockoutKey);
    });
  }
}

export const securityStateService = new SecurityStateService();
