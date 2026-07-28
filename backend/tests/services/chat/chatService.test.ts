import {
  Prisma,
  type CategoryMapping,
  type ChatMessage,
  type PendingConfirmation,
  type Transaction,
  type User,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BulkTransactionEntities,
  ChatResponsePayload,
  ConversationState,
  OpenAIMessage,
  TransactionEntities,
} from '../../../src/types';

const pendingConfirmation = (overrides: Partial<PendingConfirmation> = {}): PendingConfirmation => ({
  id: 'pending-1',
  userId: 'user-1',
  chatMessageId: 'message-1',
  type: 'transaction',
  data: '{}',
  status: 'PENDING',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
  resolvedAt: null,
  ...overrides,
});

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'transaction-1',
  amount: new Prisma.Decimal(0),
  description: 'test transaction',
  category: 'Food & Dining',
  categoryKey: 'food-dining',
  type: 'EXPENSE',
  source: 'chat',
  date: new Date(),
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const chatMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'message-1',
  userId: 'user-1',
  role: 'ASSISTANT',
  content: 'ok',
  intent: null,
  metadata: null,
  tokenCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const categoryMapping = (overrides: Partial<CategoryMapping> = {}): CategoryMapping => ({
  id: 'mapping-1',
  userId: 'user-1',
  keyword: 'food',
  category: 'Food & Dining',
  confidence: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const user = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  password: null,
  avatar: null,
  role: 'USER',
  timezone: 'Asia/Kolkata',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const transactionData = (result: ChatResponsePayload): TransactionEntities =>
  result.confirmationCard?.data as TransactionEntities;

const bulkTransactionData = (result: ChatResponsePayload): BulkTransactionEntities =>
  result.confirmationCard?.data as BulkTransactionEntities;

const fsmMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  transition: vi.fn(),
  resetToIdle: vi.fn(),
}));

vi.mock('../../../src/config/database', () => ({
  default: {
    chatMessage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    pendingConfirmation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    categoryMapping: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    budget: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const callback = arg as (client: { transaction: { create: ReturnType<typeof vi.fn> } }) => unknown;
        return callback({
          transaction: {
            create: vi.fn(),
          },
        });
      }
      return arg;
    }),
  },
}));

vi.mock('../../../src/services/chat/contextManager', () => ({
  ContextManager: class {
    async buildContextWindow(): Promise<OpenAIMessage[]> {
      return [];
    }
  },
}));

vi.mock('../../../src/services/chat/conversationStateMachine', () => ({
  ConversationStateMachine: class {
    async getState() {
      return fsmMocks.getState();
    }
    async transition(userId: string, event: string, data?: Partial<ConversationState>) {
      return fsmMocks.transition(userId, event, data);
    }
    async resetToIdle() {
      return fsmMocks.resetToIdle();
    }
  },
}));

vi.mock('../../../src/services/aiService', () => ({
  AiService: class {
    async getFinancialAdvice() {
      return { advice: 'mock advice' };
    }
  },
}));

import prisma from '../../../src/config/database';
import { ChatService } from '../../../src/services/chat/chatService';

describe('ChatService monthly summary flow', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
    vi.clearAllMocks();
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'IDLE',
      pendingConfirmationId: null,
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: null,
    });
    fsmMocks.transition.mockResolvedValue({
      userId: 'user-1',
      state: 'IDLE',
      pendingConfirmationId: null,
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: null,
    });
    fsmMocks.resetToIdle.mockResolvedValue(undefined);
    vi.mocked(prisma.categoryMapping.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.categoryMapping.findMany).mockResolvedValue([]);
    vi.mocked(prisma.categoryMapping.create).mockResolvedValue(categoryMapping());
    vi.mocked(prisma.categoryMapping.update).mockResolvedValue(categoryMapping());
    vi.mocked(prisma.pendingConfirmation.create).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.pendingConfirmation.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.chatMessage.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.budget.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      if (typeof fn === 'function') {
        const callback = fn as (client: Prisma.TransactionClient) => unknown;
        return callback({
          pendingConfirmation: { updateMany: prisma.pendingConfirmation.updateMany },
          transaction: { create: prisma.transaction.create },
          budget: { create: prisma.budget.create },
          chatMessage: { create: prisma.chatMessage.create },
        } as unknown as Prisma.TransactionClient);
      }
      return fn;
    });
  });

  it('routes "Monthly summary" to spending analytics response', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user());

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      transaction({ amount: new Prisma.Decimal(400) }),
      transaction({
        id: 'transaction-2',
        amount: new Prisma.Decimal(600),
        category: 'Transportation',
        categoryKey: 'transportation',
      }),
    ]);

    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1' }));

    const result = await service.processMessage('user-1', 'Monthly summary');

    expect(prisma.transaction.findMany).toHaveBeenCalled();
    expect(result.message.toLowerCase()).toContain('spent');
    expect(result.message).toContain('₹1,000');
    expect(result.message.toLowerCase()).toContain('this month');
    expect(result.suggestedChips).toEqual([]);
  });

  it('parses multi-line expense lists into a pending bulk confirmation', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1' }));

    const result = await service.processMessage('user-1', 'netflix 500\nhotstar 300\nyoutube 300');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(bulkTransactionData(result).items).toHaveLength(3);
    expect(result.message).toContain('₹1,100');
    expect(result.message).toContain('Confirm all');
    expect(result.suggestedChips).toEqual([]);
  });

  it('parses single-line amount-first bulk entries into a pending bulk confirmation', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1b' }));

    const result = await service.processMessage('user-1', '500 dosa 30 chai 400 coffee 20 auto');

    const items = bulkTransactionData(result).items;
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(items).toHaveLength(4);
    expect(result.message).toContain('₹950');
    expect(items.map(item => item.description)).toEqual(['dosa', 'chai', 'coffee', 'auto']);
    expect(result.suggestedChips).toEqual([]);
  });

  it('fuzzy-matches known item keywords in single-line bulk entries', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1b-typos' }));

    const result = await service.processMessage('user-1', '50 dosa 60 idli 80 samosa 90 lynch');

    const items = bulkTransactionData(result).items;
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(items).toHaveLength(4);
    expect(items.map(item => item.category)).toEqual([
      'Food & Dining',
      'Food & Dining',
      'Food & Dining',
      'Food & Dining',
    ]);
  });

  it('fuzzy-matches known item keywords in description-first bulk entries', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1b-description-typos' }));

    const result = await service.processMessage('user-1', 'dosa 50 idli 60 samosa 80 lynch 90');

    const items = bulkTransactionData(result).items;
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(items.map(item => item.description)).toEqual(['dosa', 'idli', 'samosa', 'lynch']);
    expect(items.map(item => item.category)).toEqual([
      'Food & Dining',
      'Food & Dining',
      'Food & Dining',
      'Food & Dining',
    ]);
  });

  it.each([
    ['coffee 400', 'coffee', 400],
    ['chai 60', 'chai', 60],
    ['lunch 500', 'lunch', 500],
    ['500 lunch', 'lunch', 500],
  ])('parses single shorthand "%s" into a pending transaction confirmation', async (message, description, amount) => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1c' }));

    const result = await service.processMessage('user-1', message);

    expect(result.confirmationCard?.type).toBe('transaction');
    expect(transactionData(result).description).toBe(description);
    expect(transactionData(result).amount).toBe(amount);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['food 400', 'Food & Dining'],
    ['fod 400', 'Food & Dining'],
    ['foood 400', 'Food & Dining'],
    ['coffee 400', 'Food & Dining'],
    ['burger 400', 'Food & Dining'],
    ['lynch 90', 'Food & Dining'],
    ['cofee 40', 'Food & Dining'],
    ['burgar 120', 'Food & Dining'],
    ['sandwitch 100', 'Food & Dining'],
    ['transport 80', 'Transportation'],
    ['transprt 80', 'Transportation'],
    ['uber 500', 'Transportation'],
    ['ubbr 200', 'Transportation'],
    ['grocery 500', 'Groceries & Household'],
    ['groceries 500', 'Groceries & Household'],
    ['shopping 500', 'Shopping & Clothing'],
    ['shoping 500', 'Shopping & Clothing'],
    ['misc 100', 'Miscellaneous'],
  ])('uses canonical selector category for "%s"', async (message, category) => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm-category' }));

    const result = await service.processMessage('user-1', message);

    expect(result.confirmationCard?.type).toBe('transaction');
    expect(transactionData(result).category).toBe(category);
  });

  it('keeps salary shorthand as income', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm-salary' }));

    const result = await service.processMessage('user-1', 'salary 60000');

    expect(result.confirmationCard?.type).toBe('transaction');
    expect(transactionData(result).type).toBe('income');
    expect(transactionData(result).category).toBe('Salary/Wages');
  });

  it('keeps natural expense commands as pending transaction confirmations', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1d' }));

    const result = await service.processMessage('user-1', 'spent 400 on burger');

    expect(result.confirmationCard?.type).toBe('transaction');
    expect(transactionData(result).description).toBe('burger');
    expect(transactionData(result).amount).toBe(400);
  });

  it('keeps multi-item amount-first commands on the bulk confirmation path', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm1e' }));

    const result = await service.processMessage('user-1', '500 coffee 300 chai 800 burger');

    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(bulkTransactionData(result).items).toHaveLength(3);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('parses income list header into a pending bulk confirmation', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm2' }));

    const result = await service.processMessage('user-1', 'income:\nsalary 60000\nfreelance 15000');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(bulkTransactionData(result).items).toHaveLength(2);
    expect(result.message).toContain('₹75,000');
  });

  it('parses mixed Income/Expense headers with amount-first expense lines', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm3' }));

    const result = await service.processMessage(
      'user-1',
      'Income:\nsalary 70000\nfreelance 15000\nmubasha 2000\n\nExpense:\n500 coffee\n400 book\n300 sandwich'
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(bulkTransactionData(result).items).toHaveLength(6);
    expect(bulkTransactionData(result).skippedLines).toEqual([]);
  });

  it('supports third header blocks like Investment without skipping header lines', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm4' }));

    const result = await service.processMessage(
      'user-1',
      'Income:\nsalary 70000\nfreelance 15000\nmubasha 2000\n\nExpense:\n500 coffee\n400 book\n300 sandwich\n\nInvestment:\n5000 SIP'
    );

    const items = bulkTransactionData(result).items;
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(items).toHaveLength(7);
    expect(bulkTransactionData(result).skippedLines).toEqual([]);
    expect(items[6].description).toBe('SIP');
    expect(items[6].category).toBe('Mutual Fund SIP');
  });

  it('categorizes single-line SIP entries as Mutual Fund SIP instead of Miscellaneous', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm5' }));

    const result = await service.processMessage('user-1', '500 SIP');

    expect(result.confirmationCard).not.toBeNull();
    expect(result.confirmationCard?.type).toBe('transaction');
    expect(transactionData(result).category).toBe('Mutual Fund SIP');
    expect(result.message).toContain('Mutual Fund SIP');
  });

  it('treats dividend-style entries as income and categorizes them as Dividend Income', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm6' }));

    const result = await service.processMessage('user-1', 'dividend 500');

    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).type).toBe('income');
    expect(transactionData(result).category).toBe('Dividend Income');
    expect(result.message).toContain('Dividend Income');
  });

  it('starts expense capture mode instead of creating a fake quick-action transaction', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm7' }));

    const result = await service.processMessage('user-1', 'Log expense');

    expect(result.conversationState).toBe('AWAITING_EXPENSE_DETAILS');
    expect(result.message).toContain('What did you spend on');
    expect(prisma.pendingConfirmation.create).not.toHaveBeenCalled();
    expect(fsmMocks.transition).toHaveBeenCalledWith(
      'user-1',
      'START_LOG_EXPENSE',
      expect.objectContaining({ lastIntent: 'LOG_EXPENSE' })
    );
  });

  it('creates an expense confirmation from details while awaiting expense capture', async () => {
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'AWAITING_EXPENSE_DETAILS',
      pendingConfirmationId: null,
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: 'LOG_EXPENSE',
    });
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm8' }));

    const result = await service.processMessage('user-1', '400 burger');

    expect(result.confirmationCard).not.toBeNull();
    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(transactionData(result).amount).toBe(400);
    expect(transactionData(result).description).toBe('burger');
    expect(transactionData(result).category).toBe('Food & Dining');
  });

  it('applies typed edits while awaiting confirmation and keeps confirmation state', async () => {
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'AWAITING_CONFIRMATION',
      pendingConfirmationId: 'pending-1',
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: 'LOG_EXPENSE',
    });
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 400,
          description: 'burger',
          category: 'Food & Dining',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm9', role: 'USER' }));

    const result = await service.processMessage('user-1', 'change amount to 500 category Transport');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).amount).toBe(500);
    expect(transactionData(result).category).toBe('Transportation');
    expect(fsmMocks.resetToIdle).not.toHaveBeenCalled();
    expect(fsmMocks.transition).toHaveBeenCalledWith('user-1', 'EDIT_APPLIED', {
      pendingConfirmationId: 'pending-1',
    });
  });

  it('keeps pending confirmation state when explicit edit is requested', async () => {
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'AWAITING_CONFIRMATION',
      pendingConfirmationId: 'pending-1',
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: 'LOG_EXPENSE',
    });
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm10', role: 'USER', content: 'Edit' }));

    const result = await service.processMessage('user-1', 'Edit');

    expect(result.conversationState).toBe('AWAITING_EDIT_DETAILS');
    expect(result.message).toContain('What would you like to edit');
    expect(result.suggestedChips).toEqual([]);
    expect(fsmMocks.transition).toHaveBeenCalledWith('user-1', 'EDIT_REQUESTED', {
      pendingConfirmationId: 'pending-1',
    });
    expect(prisma.pendingConfirmation.update).not.toHaveBeenCalled();
  });

  it('applies amount and description from edit details after explicit edit', async () => {
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'AWAITING_EDIT_DETAILS',
      pendingConfirmationId: 'pending-1',
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: 'LOG_EXPENSE',
    });
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 400,
          description: 'burger',
          category: 'Food & Dining',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(
      chatMessage({ id: 'm11', role: 'USER', content: '300 noodles' })
    );

    const result = await service.processMessage('user-1', '300 noodles');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).amount).toBe(300);
    expect(transactionData(result).description).toBe('noodles');
    expect(transactionData(result).category).toBe('Miscellaneous');
    expect(fsmMocks.transition).toHaveBeenCalledWith('user-1', 'EDIT_APPLIED', {
      pendingConfirmationId: 'pending-1',
    });
  });

  it('applies category from edit details after explicit edit', async () => {
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'AWAITING_EDIT_DETAILS',
      pendingConfirmationId: 'pending-1',
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: 'LOG_EXPENSE',
    });
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 400,
          description: 'burger',
          category: 'Miscellaneous',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(
      chatMessage({ id: 'm12', role: 'USER', content: 'category Food' })
    );

    const result = await service.processMessage('user-1', 'category Food');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).amount).toBe(400);
    expect(transactionData(result).description).toBe('burger');
    expect(transactionData(result).category).toBe('Food & Dining');
  });

  it('recalculates category when edited description changes without explicit category', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 200,
          description: 'autp',
          category: 'Food & Dining',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());

    const result = await service.editAction('user-1', 'pending-1', { description: 'auto' });

    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).description).toBe('auto');
    expect(transactionData(result).category).toBe('Transportation');
  });

  it('recalculates category to Transport when edited description changes to Cab', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 200,
          description: 'misc',
          category: 'Food & Dining',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());

    const result = await service.editAction('user-1', 'pending-1', { description: 'Cab' });

    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).description).toBe('Cab');
    expect(transactionData(result).category).toBe('Transportation');
  });

  it('does not recalculate category when category is explicitly edited', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 200,
          description: 'autp',
          category: 'Miscellaneous',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());

    const result = await service.editAction('user-1', 'pending-1', {
      description: 'auto',
      category: 'Food',
    });

    expect(result.confirmationCard).not.toBeNull();
    expect(transactionData(result).description).toBe('auto');
    expect(transactionData(result).category).toBe('Food & Dining');
  });

  it('blocks unrelated messages while a confirmation is pending', async () => {
    fsmMocks.getState.mockResolvedValue({
      userId: 'user-1',
      state: 'AWAITING_CONFIRMATION',
      pendingConfirmationId: 'pending-1',
      pendingData: null,
      stateEnteredAt: new Date().toISOString(),
      clarificationAttempts: 0,
      lastIntent: 'LOG_EXPENSE',
    });
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(
      chatMessage({ id: 'm13', role: 'USER', content: '300 noodles' })
    );

    const result = await service.processMessage('user-1', '300 noodles');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.message).toBe('You already have a pending transaction. Please Confirm, Cancel, or Edit it first.');
    expect(result.suggestedChips).toEqual([]);
    expect(prisma.pendingConfirmation.create).not.toHaveBeenCalled();
  });

  it('persists a canonical transaction and success message when confirming', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 500,
          description: 'chai',
          category: 'Food & Dining',
          type: 'expense',
          date: null,
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.transaction.create).mockResolvedValue(transaction());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm14' }));

    const result = await service.confirmAction('user-1', 'pending-1');

    expect(result.message).toContain('Logged ₹500 as Food & Dining');
    expect(result.message).toContain('chai, today');
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        category: 'Food & Dining',
        categoryKey: 'food-dining',
        type: 'EXPENSE',
      }),
    });
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        role: 'ASSISTANT',
        content: result.message,
        intent: 'LOG_EXPENSE',
      }),
    });
  });

  it('claims a pending confirmation once when duplicate confirms race', async () => {
    const pending = pendingConfirmation({
      id: 'pending-race',
      data: JSON.stringify({
        amount: 500,
        description: 'chai',
        category: 'Food & Dining',
        type: 'expense',
        date: null,
      }),
    });
    let claimed = false;
    const claim = vi.fn(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(pending);
    vi.mocked(prisma.transaction.create).mockResolvedValue(transaction());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage());
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        fn({
          pendingConfirmation: { updateMany: claim },
          transaction: { create: prisma.transaction.create },
          chatMessage: { create: prisma.chatMessage.create },
        } as unknown as Prisma.TransactionClient)
    );

    const results = await Promise.all([
      service.confirmAction('user-1', pending.id),
      service.confirmAction('user-1', pending.id),
    ]);

    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
    expect(results.filter(result => result.message.startsWith('Logged'))).toHaveLength(1);
    expect(results.filter(result => result.message.includes('already been confirmed'))).toHaveLength(1);
  });

  it('persists edited confirmation data through the canonical write layer', async () => {
    const pending = pendingConfirmation({
      id: 'pending-edited',
      data: JSON.stringify({
        amount: 500,
        description: 'chai',
        category: 'Food & Dining',
        type: 'expense',
        date: null,
      }),
    });
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(pending);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(
      pendingConfirmation({ id: pending.id, status: 'EDITED' })
    );
    vi.mocked(prisma.transaction.create).mockResolvedValue(transaction());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'edited-success' }));

    await service.editAction('user-1', pending.id, {
      amount: 750,
      category: 'Transportation',
    });
    const editedData = vi.mocked(prisma.pendingConfirmation.update).mock.calls[0][0].data.data;
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      ...pending,
      data: editedData,
    });

    await service.confirmAction('user-1', pending.id);

    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 750,
        category: 'Transportation',
        categoryKey: 'transportation',
        source: 'chat',
      }),
    });
  });

  it('confirms pending bulk transactions and persists the success summary', async () => {
    const bulkCreate = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementationOnce(
      async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        fn({
          pendingConfirmation: { updateMany: prisma.pendingConfirmation.updateMany },
          transaction: { create: bulkCreate },
          chatMessage: { create: prisma.chatMessage.create },
        } as unknown as Prisma.TransactionClient)
    );
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-bulk',
        type: 'bulk_transaction',
        data: JSON.stringify({
          items: [
            {
              amount: 500,
              description: 'chai',
              category: 'Food & Dining',
              type: 'expense',
              date: null,
            },
            {
              amount: 300,
              description: 'coffee',
              category: 'Food & Dining',
              type: 'expense',
              date: null,
            },
          ],
          skippedLines: [],
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.chatMessage.create).mockResolvedValue(chatMessage({ id: 'm15' }));

    const result = await service.confirmAction('user-1', 'pending-bulk');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(bulkCreate).toHaveBeenCalledTimes(2);
    expect(bulkCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ categoryKey: 'food-dining', source: 'chat' }),
    });
    expect(bulkCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ categoryKey: 'food-dining', source: 'chat' }),
    });
    expect(result.message).toContain('Logged 2 expense item(s)');
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        role: 'ASSISTANT',
        content: result.message,
        intent: 'LOG_EXPENSE',
      }),
    });
  });

  it('cancels a single pending confirmation and hides the original user command', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-1',
        data: JSON.stringify({
          amount: 400,
          description: 'coffee',
          category: 'Food & Dining',
          type: 'expense',
          date: null,
          sourceUserMessageId: 'user-msg-1',
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.chatMessage.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.cancelAction('user-1', 'pending-1');

    expect(result.message).toBe('');
    expect(result.metadata).toBe(JSON.stringify({ hiddenMessageId: 'user-msg-1' }));
    expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-msg-1', userId: 'user-1', role: 'USER' },
      data: {
        metadata: JSON.stringify({
          hiddenFromChat: true,
          hiddenReason: 'cancelled_confirmation',
        }),
      },
    });
    expect(prisma.pendingConfirmation.update).toHaveBeenCalledWith({
      where: { id: 'pending-1' },
      data: { status: 'CANCELLED', resolvedAt: expect.any(Date) },
    });
  });

  it('cancels a bulk pending confirmation and hides the original user command', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(
      pendingConfirmation({
        id: 'pending-bulk',
        type: 'bulk_transaction',
        data: JSON.stringify({
          items: [
            {
              amount: 500,
              description: 'coffee',
              category: 'Food & Dining',
              type: 'expense',
              date: null,
            },
            {
              amount: 300,
              description: 'chai',
              category: 'Food & Dining',
              type: 'expense',
              date: null,
            },
          ],
          skippedLines: [],
          sourceUserMessageId: 'bulk-user-msg',
        }),
      })
    );
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue(pendingConfirmation());
    vi.mocked(prisma.chatMessage.updateMany).mockResolvedValue({ count: 1 });

    const result = await service.cancelAction('user-1', 'pending-bulk');

    expect(result.message).toBe('');
    expect(result.metadata).toBe(JSON.stringify({ hiddenMessageId: 'bulk-user-msg' }));
    expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bulk-user-msg', userId: 'user-1', role: 'USER' },
      })
    );
  });

  it('returns latest chat history in chronological display order', async () => {
    const newest = chatMessage({
      id: 'm3',
      content: 'newest',
      createdAt: new Date('2026-01-03'),
    });
    const middle = chatMessage({
      id: 'm2',
      role: 'USER',
      content: 'middle',
      createdAt: new Date('2026-01-02'),
    });
    const oldestOfPage = chatMessage({
      id: 'm1',
      content: 'oldest of page',
      createdAt: new Date('2026-01-01'),
    });
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([newest, middle, oldestOfPage]);

    const result = await service.getHistory('user-1', 3, 0);

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', role: { not: 'SYSTEM' }, pendingConfirmation: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
        skip: 0,
      })
    );
    expect(result.map(message => message.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('includes active pending confirmation metadata for refresh recovery', async () => {
    const pending = pendingConfirmation({
      id: 'pending-refresh',
      chatMessageId: 'confirm-message',
      data: JSON.stringify({
        amount: 400,
        description: 'coffee',
        category: 'Food & Dining',
        type: 'expense',
        date: null,
      }),
    });
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue(pending);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([
      chatMessage({ id: 'user-message', role: 'USER', content: '400 coffee' }),
    ]);
    vi.mocked(prisma.chatMessage.findFirst).mockResolvedValue(
      chatMessage({ id: 'confirm-message', content: 'Confirm this transaction?' })
    );

    const result = await service.getHistory('user-1', 50, 0);
    const restored = result.find(message => message.id === 'confirm-message');
    const metadata = JSON.parse(restored?.metadata || '{}');

    expect(metadata.confirmationCard).toEqual(
      expect.objectContaining({
        id: 'pending-refresh',
        type: 'transaction',
        status: 'PENDING',
      })
    );
  });

  it('excludes hidden cancelled-command messages from chat history', async () => {
    const visible = chatMessage({
      id: 'm2',
      content: 'visible',
      createdAt: new Date('2026-01-02'),
    });
    const hidden = chatMessage({
      id: 'm1',
      role: 'USER',
      content: 'coffee 400',
      metadata: JSON.stringify({ hiddenFromChat: true, hiddenReason: 'cancelled_confirmation' }),
      createdAt: new Date('2026-01-01'),
    });
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([visible, hidden]);

    const result = await service.getHistory('user-1', 50, 0);

    expect(result.map(message => message.id)).toEqual(['m2']);
  });
});
