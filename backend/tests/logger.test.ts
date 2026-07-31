import { afterEach, describe, expect, it, vi } from 'vitest';

describe('production logger', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_FILE;
    delete process.env.SENTRY_DSN;
    vi.resetModules();
  });

  it('writes to a console transport without requiring a file transport', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_FILE;
    delete process.env.SENTRY_DSN;
    vi.resetModules();

    const { default: logger } = await import('../src/config/logger');
    const transportNames = logger.transports.map((transport) => transport.constructor.name);

    expect(transportNames).toContain('Console');
    expect(transportNames).not.toContain('File');

    logger.close();
  });
});
