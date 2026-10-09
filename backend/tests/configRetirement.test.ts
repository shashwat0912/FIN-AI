import { afterEach, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('../src/config/logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));
afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('node:crypto'); vi.resetModules(); });

it('generates distinct development signing keys without persisting them', async () => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('JWT_SECRET', '');
  vi.stubEnv('JWT_REFRESH_SECRET', '');
  const { config } = await import('../src/config/env');
  expect(config.JWT_SECRET).toMatch(/^[a-f0-9]{128}$/);
  expect(config.JWT_REFRESH_SECRET).toMatch(/^[a-f0-9]{128}$/);
  expect(config.JWT_SECRET).not.toBe(config.JWT_REFRESH_SECRET);
});

it.each(['production', 'test'])('still requires supplied keys in %s', async environment => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', environment);
  vi.stubEnv('JWT_SECRET', '');
  vi.stubEnv('JWT_REFRESH_SECRET', '');
  await expect(import('../src/config/env')).rejects.toThrow('JWT_SECRET');
});

it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET'])('blocks a historical fingerprint in production %s', async name => {
  const digest = vi.fn().mockReturnValue('2cb69e67e55e');
  if (name === 'JWT_REFRESH_SECRET') digest.mockReturnValueOnce('unrelated');
  vi.doMock('node:crypto', async importOriginal => ({
    ...await importOriginal<typeof import('node:crypto')>(),
    createHash: () => ({ update: () => ({ digest }) }),
  }));
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('JWT_SECRET', 'a'.repeat(64));
  vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(64));
  vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
  await expect(import('../src/config/env')).rejects.toThrow(`${name} is a retired historical credential`);
});
