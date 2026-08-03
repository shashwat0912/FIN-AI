import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import logger from '../config/logger';
import { IdempotencyService } from '../services/chat/idempotencyService';
import { distributedJobLease } from '../services/distributedJobLease';

const idempotencyService = new IdempotencyService();

export function startIdempotencyCleanupJob(): ScheduledTask {
  const task = cron.schedule('0 * * * *', async () => {
    try {
      await distributedJobLease.runJob('idempotency-cleanup', async () => {
        await idempotencyService.cleanup();
      });
    } catch (err) {
      logger.error('Idempotency cleanup job failed', {
        event: 'idempotency_cleanup_job_failed',
        outcome: 'failure',
        errorCategory: err instanceof Error ? err.name : 'unknown',
      });
    }
  });

  logger.info('Idempotency cleanup job scheduled (every hour)');
  return task;
}
