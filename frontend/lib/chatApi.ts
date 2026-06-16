import { ChatResponsePayload, ChatMessage, ApiResponse } from '../types';
import { apiClient } from './api';
import { logger } from '../utils/logger';

const TRANSIENT_RETRY_DELAYS_MS = [300, 900];

type RetryableChatError = Error & {
  status?: number;
  isAuthError?: boolean;
  isNetworkError?: boolean;
};

function generateKey(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getMutationOptions(): RequestInit {
  return {
    headers: {
      'X-Idempotency-Key': generateKey(),
    },
  };
}

function unwrapData<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response.data == null) {
    throw new Error(fallbackMessage);
  }

  return response.data;
}

function normalizeChatError(error: unknown): never {
  if (error instanceof Error && error.message) {
    throw error;
  }

  throw new Error('Chat service is temporarily unreachable. Please try again.');
}

function isTransientChatFailure(error: unknown): error is RetryableChatError {
  if (!(error instanceof Error)) {
    return false;
  }

  const retryableError = error as RetryableChatError;
  if (retryableError.isNetworkError) {
    return true;
  }

  return retryableError.status === 408 || retryableError.status === 502 || retryableError.status === 503 || retryableError.status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTransientRetry<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientChatFailure(error) || attempt >= TRANSIENT_RETRY_DELAYS_MS.length) {
        throw error;
      }

      const delayMs = TRANSIENT_RETRY_DELAYS_MS[attempt];
      attempt += 1;

      logger.warn('Retrying chat request after transient failure', {
        operationName,
        attempt,
        delayMs,
        reason: error.message,
      });

      await sleep(delayMs);
    }
  }
}

export const chatApi = {
  async sendMessage(content: string): Promise<ChatResponsePayload> {
    try {
      const requestOptions = getMutationOptions();
      const response = await withTransientRetry('sendMessage', () =>
        apiClient.post<ChatResponsePayload>(
          '/chat/message',
          { content },
          requestOptions
        )
      );
      return unwrapData(response, 'Chat response was empty');
    } catch (error) {
      normalizeChatError(error);
    }
  },

  async confirmAction(confirmationId: string): Promise<ChatResponsePayload> {
    try {
      const requestOptions = getMutationOptions();
      const response = await withTransientRetry('confirmAction', () =>
        apiClient.post<ChatResponsePayload>(
          '/chat/confirm',
          { confirmationId },
          requestOptions
        )
      );
      return unwrapData(response, 'Confirmation response was empty');
    } catch (error) {
      normalizeChatError(error);
    }
  },

  async editAction(confirmationId: string, data: Record<string, unknown>): Promise<ChatResponsePayload> {
    try {
      const requestOptions = getMutationOptions();
      const response = await withTransientRetry('editAction', () =>
        apiClient.post<ChatResponsePayload>(
          '/chat/edit',
          { confirmationId, data },
          requestOptions
        )
      );
      return unwrapData(response, 'Edit response was empty');
    } catch (error) {
      normalizeChatError(error);
    }
  },

  async getHistory(limit = 50, offset = 0): Promise<ChatMessage[]> {
    try {
      const response = await withTransientRetry('getHistory', () =>
        apiClient.get<ChatMessage[]>(`/chat/history?limit=${limit}&offset=${offset}`)
      );
      return response.data || [];
    } catch (error) {
      normalizeChatError(error);
    }
  },
};
