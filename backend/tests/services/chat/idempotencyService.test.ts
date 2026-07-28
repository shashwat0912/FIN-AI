import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/database', () => ({
  default: {
    idempotencyLog: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import { IdempotencyService } from '../../../src/services/chat/idempotencyService';

const log = (overrides: Record<string, unknown> = {}) => ({
  key: 'same-key',
  userId: 'user-1',
  endpoint: '/confirm',
  status: 'COMPLETED',
  requestHash: 'hash-1',
  response: JSON.stringify({ success: true }),
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides,
});

describe('IdempotencyService', () => {
  const service = new IdempotencyService();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.idempotencyLog.deleteMany).mockResolvedValue({ count: 1 });
  });

  it('does not expose or reuse a completed response across users', async () => {
    vi.mocked(prisma.idempotencyLog.findUnique).mockResolvedValue(log({ userId: 'user-2' }));

    const result = await service.check('same-key', 'user-1', '/confirm');

    expect(result).toEqual({ status: 'conflict', cachedResponse: null, requestHash: null });
  });

  it('does not reuse a key across endpoints', async () => {
    vi.mocked(prisma.idempotencyLog.findUnique).mockResolvedValue(log({ endpoint: '/message' }));

    const result = await service.check('same-key', 'user-1', '/confirm');

    expect(result.status).toBe('conflict');
  });

  it('returns the cached response only for the owning request', async () => {
    vi.mocked(prisma.idempotencyLog.findUnique).mockResolvedValue(log());

    const result = await service.check('same-key', 'user-1', '/confirm');

    expect(result).toEqual({
      status: 'completed',
      cachedResponse: JSON.stringify({ success: true }),
      requestHash: 'hash-1',
    });
  });

  it('releases failed and expired keys for a controlled retry', async () => {
    vi.mocked(prisma.idempotencyLog.findUnique)
      .mockResolvedValueOnce(log({ status: 'FAILED' }))
      .mockResolvedValueOnce(log({ expiresAt: new Date(Date.now() - 1_000) }));

    const failed = await service.check('same-key', 'user-1', '/confirm');
    const expired = await service.check('same-key', 'user-1', '/confirm');

    expect(failed.status).toBe('new');
    expect(expired.status).toBe('new');
    expect(prisma.idempotencyLog.deleteMany).toHaveBeenCalledTimes(2);
  });
});
