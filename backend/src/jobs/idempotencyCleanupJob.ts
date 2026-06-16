import cron from 'node-cron';
import logger from '../config/logger';
import { IdempotencyService } from '../services/chat/idempotencyService';

const idempotencyService = new IdempotencyService();

export function startIdempotencyCleanupJob(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      await idempotencyService.cleanup();
    } catch (err) {
      logger.error('Idempotency cleanup job error:', err);
    }
  });

  logger.info('Idempotency cleanup job scheduled (every hour)');
}
