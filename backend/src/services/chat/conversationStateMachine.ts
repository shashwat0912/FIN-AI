import logger from '../../config/logger';
import { getRedisClient } from '../../config/redis';
import { ConversationState, ConversationStateType, ChatIntentType } from '../../types';

const STATE_PREFIX = 'conv:state:';
const LOCK_PREFIX = 'conv:lock:';
const STATE_TTL_SECONDS = 300; // 5 minutes
const LOCK_TTL_SECONDS = 5;
const MAX_CLARIFICATION_ATTEMPTS = 3;

function defaultState(userId: string): ConversationState {
  return {
    userId,
    state: 'IDLE',
    pendingConfirmationId: null,
    pendingData: null,
    stateEnteredAt: new Date().toISOString(),
    clarificationAttempts: 0,
    lastIntent: null,
  };
}

export class ConversationStateMachine {
  async getState(userId: string): Promise<ConversationState> {
    try {
      const redis = getRedisClient();
      const raw = await redis.get(`${STATE_PREFIX}${userId}`);
      if (!raw) return defaultState(userId);
      return JSON.parse(raw);
    } catch {
      return defaultState(userId);
    }
  }

  async transition(userId: string, event: string, data?: Partial<ConversationState>): Promise<ConversationState> {
    const redis = getRedisClient();
    const lockKey = `${LOCK_PREFIX}${userId}`;

    // Acquire lock
    const acquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!acquired) {
      logger.warn(`Could not acquire lock for user ${userId}, proceeding anyway`);
    }

    try {
      const current = await this.getState(userId);
      const next = this.computeNextState(current, event, data);

      const nextComparable = { ...next, stateEnteredAt: current.stateEnteredAt };
      const hasChanged = JSON.stringify(nextComparable) !== JSON.stringify(current);
      const shouldRefreshState = event === 'EDIT_APPLIED';

      if (hasChanged || shouldRefreshState) {
        next.stateEnteredAt = new Date().toISOString();
        await redis.set(`${STATE_PREFIX}${userId}`, JSON.stringify(next), 'EX', STATE_TTL_SECONDS);
      }

      return next;
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  }

  async resetToIdle(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`${STATE_PREFIX}${userId}`);
    } catch {
      // Non-critical
    }
  }

  async expireStaleStates(): Promise<void> {
    // Redis TTL handles expiration automatically.
    // This method exists for interface compatibility with the background job.
    logger.info('Conversation state expiry check (handled by Redis TTL)');
  }

  private computeNextState(
    current: ConversationState,
    event: string,
    data?: Partial<ConversationState>
  ): ConversationState {
    const merged = { ...current, ...data };

    switch (current.state) {
      case 'IDLE':
        if (event === 'MESSAGE_RECEIVED') return { ...merged, state: 'PROCESSING' };
        if (event === 'START_LOG_EXPENSE') {
          return {
            ...merged,
            state: 'AWAITING_EXPENSE_DETAILS',
            lastIntent: ChatIntentType.LOG_EXPENSE,
          };
        }
        if (event === 'EDIT_APPLIED' && merged.pendingConfirmationId) {
          return { ...merged, state: 'AWAITING_CONFIRMATION' };
        }
        return current;

      case 'PROCESSING':
        if (event === 'INTENT_PARSED') return { ...merged, state: 'AWAITING_CONFIRMATION' };
        if (event === 'CATEGORY_UNCLEAR') {
          return { ...merged, state: 'AWAITING_CATEGORY', clarificationAttempts: 1 };
        }
        if (event === 'START_LOG_EXPENSE') {
          return {
            ...merged,
            state: 'AWAITING_EXPENSE_DETAILS',
            lastIntent: ChatIntentType.LOG_EXPENSE,
          };
        }
        if (event === 'EXPENSE_DETAILS_RECEIVED') return { ...merged, state: 'PROCESSING' };
        if (event === 'EDIT_APPLIED' && merged.pendingConfirmationId) {
          return { ...merged, state: 'AWAITING_CONFIRMATION' };
        }
        if (event === 'RESPONSE_SENT') return { ...merged, state: 'IDLE' };
        return current;

      case 'AWAITING_EXPENSE_DETAILS':
        if (event === 'EXPENSE_DETAILS_RECEIVED') return { ...merged, state: 'PROCESSING' };
        if (event === 'CANCELLED' || event === 'EXPIRED') return { ...defaultState(current.userId) };
        if (event === 'START_LOG_EXPENSE') {
          return {
            ...merged,
            state: 'AWAITING_EXPENSE_DETAILS',
            lastIntent: ChatIntentType.LOG_EXPENSE,
          };
        }
        return current;

      case 'AWAITING_CATEGORY':
        if (event === 'CATEGORY_SELECTED') return { ...merged, state: 'AWAITING_CONFIRMATION' };
        if (event === 'EXPIRED' || event === 'MAX_ATTEMPTS') {
          return { ...defaultState(current.userId) };
        }
        if (event === 'UNRELATED_MESSAGE') return { ...defaultState(current.userId) };
        if (event === 'CLARIFICATION_RETRY') {
          const attempts = current.clarificationAttempts + 1;
          if (attempts >= MAX_CLARIFICATION_ATTEMPTS) return { ...defaultState(current.userId) };
          return { ...merged, clarificationAttempts: attempts };
        }
        return current;

      case 'AWAITING_CONFIRMATION':
        if (event === 'CONFIRMED') return { ...defaultState(current.userId) };
        if (event === 'CANCELLED') return { ...defaultState(current.userId) };
        if (event === 'EDIT_REQUESTED') return { ...merged, state: 'PROCESSING' };
        if (event === 'EDIT_APPLIED') return { ...merged, state: 'AWAITING_CONFIRMATION' };
        if (event === 'EXPIRED') return { ...defaultState(current.userId) };
        return current;

      default:
        return current;
    }
  }
}
