import cron from 'node-cron';
import prisma from '../config/database';
import logger from '../config/logger';
import { ConversationStateMachine } from '../services/chat/conversationStateMachine';

const fsm = new ConversationStateMachine();

export function startStateExpiryJob(): void {
  cron.schedule('* * * * *', async () => {
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
      logger.error('State expiry job error:', err);
    }
  });

  logger.info('State expiry job scheduled (every 60s)');
}
