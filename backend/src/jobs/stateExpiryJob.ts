import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import prisma from '../config/database';
import logger from '../config/logger';
import { ConversationStateMachine } from '../services/chat/conversationStateMachine';

const fsm = new ConversationStateMachine();

export function startStateExpiryJob(): ScheduledTask {
  const task = cron.schedule('* * * * *', async () => {
    try {
      await fsm.expireStaleStates();

      const result = await prisma.pendingConfirmation.updateMany({
        where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED', resolvedAt: new Date() },
      });

      if (result.count > 0) {
        logger.info(`Expired ${result.count} stale pending confirmation(s)`);
      }
    } catch (err) {
      logger.error('State expiry job failed', {
        event: 'state_expiry_job_failed',
        outcome: 'failure',
        errorCategory: err instanceof Error ? err.name : 'unknown',
      });
    }
  });

  logger.info('State expiry job scheduled (every 60s)');
  return task;
}
