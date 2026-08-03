import { afterEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../src/config/logger', () => ({ default: logger }));

const managedEnv = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SECURITY_STATE_HMAC_SECRET',
  'CORS_ORIGIN',
  'LOG_LEVEL',
] as const;
const originalEnv = Object.fromEntries(managedEnv.map(name => [name, process.env[name]]));

async function loadConfig(environment: 'test' | 'production', securitySecret?: string) {
  vi.resetModules();
  process.env.NODE_ENV = environment;
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/finance_ai_test';
  process.env.JWT_SECRET = 'j'.repeat(64);
  process.env.JWT_REFRESH_SECRET = 'r'.repeat(64);
  process.env.CORS_ORIGIN = environment === 'production' ? 'https://finance.example' : 'http://localhost:5173';
  process.env.LOG_LEVEL = 'info';
  if (securitySecret === undefined) delete process.env.SECURITY_STATE_HMAC_SECRET;
  else process.env.SECURITY_STATE_HMAC_SECRET = securitySecret;
  return import('../src/config/env');
}

afterEach(() => {
  for (const name of managedEnv) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('security state HMAC configuration', () => {
  it('requires a dedicated secret in production', async () => {
    await expect(loadConfig('production')).rejects.toThrow(
      'SECURITY_STATE_HMAC_SECRET is required in production'
    );
  });

  it('rejects short production secrets', async () => {
    await expect(loadConfig('production', 'short')).rejects.toThrow(
      'SECURITY_STATE_HMAC_SECRET must be at least 64 characters long'
    );
  });

  it('uses the JWT secret only as an explicit non-production fallback', async () => {
    const { config } = await loadConfig('test');
    expect(config.SECURITY_STATE_HMAC_SECRET).toBe(process.env.JWT_SECRET);
  });

  it('uses the configured production secret deterministically', async () => {
    const securitySecret = 's'.repeat(64);
    const first = await loadConfig('production', securitySecret);
    const second = await loadConfig('production', securitySecret);
    expect(first.config.SECURITY_STATE_HMAC_SECRET).toBe(second.config.SECURITY_STATE_HMAC_SECRET);
  });
});
