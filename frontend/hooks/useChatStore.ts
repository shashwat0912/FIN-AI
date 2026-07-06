import { create } from 'zustand';
import { ChatMessage, ConfirmationCard, ChatResponsePayload, ChatRateLimitInfo, ChatToast } from '../types';
import { chatApi } from '../lib/chatApi';

type ChatRetryAction =
  | { type: 'send'; content: string }
  | { type: 'confirm'; cardId: string }
  | { type: 'edit'; cardId: string; data: Record<string, unknown> }
  | null;

type ChatRequestError = Error & {
  status?: number;
  isAuthError?: boolean;
  isNetworkError?: boolean;
};

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  pendingConfirmation: ConfirmationCard | null;
  suggestedChips: string[];
  conversationState: string;
  rateLimitInfo: ChatRateLimitInfo | null;
  isRateLimited: boolean;
  isFallbackMode: boolean;
  historyLoaded: boolean;
  toast: ChatToast | null;
  lastAction: ChatRetryAction;

  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  loadHistory: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  confirm: (cardId: string) => Promise<void>;
  edit: (cardId: string, data: Record<string, unknown>) => Promise<void>;
  cancel: () => Promise<void>;
  clearToast: () => void;
  retryLastAction: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => {
  const executeSendMessage = async (content: string, appendUserMessage: boolean) => {
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: appendUserMessage ? [...state.messages, userMsg] : state.messages,
      isLoading: true,
      toast: null,
      lastAction: { type: 'send', content },
    }));

    try {
      const payload = await chatApi.sendMessage(content);
      applyPayload(set, get, payload);
    } catch (err: unknown) {
      set({ toast: buildChatToast(err, 'Unable to send the message right now.'), isLoading: false });
    }
  };

  const executeConfirm = async (cardId: string) => {
    set({ isLoading: true, toast: null, lastAction: { type: 'confirm', cardId } });

    try {
      const payload = await chatApi.confirmAction(cardId);
      applyPayload(set, get, payload);
    } catch (err: unknown) {
      set({ toast: buildChatToast(err, 'Unable to confirm this action right now.'), isLoading: false });
    }
  };

  const executeEdit = async (cardId: string, data: Record<string, unknown>) => {
    set({ isLoading: true, toast: null, lastAction: { type: 'edit', cardId, data } });

    try {
      const payload = await chatApi.editAction(cardId, data);
      applyPayload(set, get, payload);
    } catch (err: unknown) {
      set({ toast: buildChatToast(err, 'Unable to update this action right now.'), isLoading: false });
    }
  };

  return {
    messages: [],
    isLoading: false,
    isOpen: false,
    pendingConfirmation: null,
    suggestedChips: [],
    conversationState: 'IDLE',
    rateLimitInfo: null,
    isRateLimited: false,
    isFallbackMode: false,
    historyLoaded: false,
    toast: null,
    lastAction: null,

    toggleChat: () => {
      const wasOpen = get().isOpen;
      set({ isOpen: !wasOpen });
      if (!wasOpen && !get().historyLoaded) {
        get().loadHistory();
      }
    },
    openChat: () => {
      set({ isOpen: true });
      if (!get().historyLoaded) get().loadHistory();
    },
    closeChat: () => set({ isOpen: false }),

    loadHistory: async () => {
      try {
        const history = await chatApi.getHistory(50, 0);
        set((state) => {
          // Avoid clobbering an active in-flight conversation when the drawer
          // opens and history loads slightly later.
          if (state.messages.length > 0) {
            return { historyLoaded: true };
          }
          return { messages: history, historyLoaded: true };
        });
      } catch (err: unknown) {
        set({ toast: buildChatToast(err, 'Unable to load chat history right now.') });
      }
    },

    sendMessage: async (content: string) => executeSendMessage(content, true),

    confirm: async (cardId: string) => executeConfirm(cardId),

    edit: async (cardId: string, data: Record<string, unknown>) => executeEdit(cardId, data),

    cancel: async () => executeSendMessage('Cancel', false),

    clearToast: () => set({ toast: null }),

    retryLastAction: async () => {
      const action = get().lastAction;
      if (!action || get().isLoading) {
        return;
      }

      switch (action.type) {
        case 'send':
          await executeSendMessage(action.content, false);
          return;
        case 'confirm':
          await executeConfirm(action.cardId);
          return;
        case 'edit':
          await executeEdit(action.cardId, action.data);
          return;
        default:
          return;
      }
    },
  };
});

function buildChatToast(error: unknown, fallback: string): ChatToast {
  const requestError = error instanceof Error ? (error as ChatRequestError) : null;
  const message = requestError?.message || fallback;
  const status = requestError?.status;

  if (requestError?.isNetworkError || message.includes('Cannot connect to backend server')) {
    return {
      id: `toast-${Date.now()}`,
      kind: 'network',
      title: 'Backend unavailable',
      message: 'Finance Chat could not reach the backend. We already retried automatically. Check the server and try again.',
      actionLabel: 'Retry',
      retryable: true,
    };
  }

  if (requestError?.isAuthError || status === 401 || message.toLowerCase().includes('session has expired')) {
    return {
      id: `toast-${Date.now()}`,
      kind: 'auth',
      title: 'Session expired',
      message: 'Your login session has expired, so chat requests are being rejected. Sign in again and retry.',
    };
  }

  if (status === 400 || status === 403 || status === 422) {
    return {
      id: `toast-${Date.now()}`,
      kind: 'validation',
      title: 'Request rejected',
      message,
    };
  }

  return {
    id: `toast-${Date.now()}`,
    kind: 'generic',
    title: 'Chat error',
    message,
  };
}

function applyPayload(
  set: (partial: Partial<ChatState>) => void,
  get: () => ChatState,
  payload: ChatResponsePayload
) {
  const hiddenMessageId = getHiddenMessageId(payload.metadata);
  const sourceUserMessageId = getSourceUserMessageId(payload.confirmationCard);
  let messages = get().messages;

  if (sourceUserMessageId) {
    const lastUserIndex = findLastUserMessageIndex(messages);
    if (lastUserIndex >= 0) {
      messages = messages.map((message, index) =>
        index === lastUserIndex ? { ...message, id: sourceUserMessageId } : message
      );
    }
  }

  if (hiddenMessageId) {
    messages = messages.filter((message) => message.id !== hiddenMessageId);
  }

  if (!payload.confirmationCard && payload.message.trim().length > 0) {
    messages = [
      ...messages,
      {
        id: `asst-${Date.now()}`,
        role: 'ASSISTANT' as const,
        content: payload.message,
        metadata: undefined,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  set({
    messages,
    isLoading: false,
    pendingConfirmation: payload.confirmationCard,
    suggestedChips: payload.suggestedChips || [],
    conversationState: payload.conversationState || 'IDLE',
    rateLimitInfo: payload.rateLimitInfo,
    isFallbackMode: payload.isFallbackMode,
    toast: null,
  });
}

function findLastUserMessageIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'USER') return index;
  }
  return -1;
}

function getSourceUserMessageId(card: ConfirmationCard | null): string | null {
  const data = card?.data as { sourceUserMessageId?: unknown } | undefined;
  return typeof data?.sourceUserMessageId === 'string' ? data.sourceUserMessageId : null;
}

function getHiddenMessageId(metadata?: string | null): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed?.hiddenMessageId === 'string' ? parsed.hiddenMessageId : null;
  } catch {
    return null;
  }
}
