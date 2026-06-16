import prisma from '../../config/database';
import logger from '../../config/logger';
import { IdempotencyCheckResult } from '../../types';

export class IdempotencyService {
  async check(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string
  ): Promise<IdempotencyCheckResult> {
    const existing = await prisma.idempotencyLog.findUnique({ where: { key } });

    if (!existing) {
      return { status: 'new', cachedResponse: null, requestHash: null };
    }

    if (existing.status === 'PROCESSING') {
      return { status: 'processing', cachedResponse: null, requestHash: existing.requestHash };
    }

    // COMPLETED
    return {
      status: 'completed',
      cachedResponse: existing.response,
      requestHash: existing.requestHash,
    };
  }

  async create(key: string, userId: string, endpoint: string, requestHash: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await prisma.idempotencyLog.create({
      data: {
        key,
        userId,
        endpoint,
        status: 'PROCESSING',
        requestHash,
        expiresAt,
      },
    });
  }

  async markCompleted(key: string, response: string): Promise<void> {
    try {
      await prisma.idempotencyLog.update({
        where: { key },
        data: { status: 'COMPLETED', response },
      });
    } catch (err) {
      logger.error(`Failed to mark idempotency key ${key} as completed`, err);
    }
  }

  async markFailed(key: string): Promise<void> {
    try {
      await prisma.idempotencyLog.update({
        where: { key },
        data: { status: 'FAILED' },
      });
    } catch (err) {
      logger.error(`Failed to mark idempotency key ${key} as failed`, err);
    }
  }

  async cleanup(): Promise<void> {
    const result = await prisma.idempotencyLog.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired idempotency log(s)`);
    }
  }
}
