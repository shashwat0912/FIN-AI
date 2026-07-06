import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsmMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  transition: vi.fn(),
  resetToIdle: vi.fn(),
}));

vi.mock('../../../src/config/database', () => ({
  default: {
    chatMessage: {
      create: vi.fn(),
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
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg({
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
    async buildContextWindow(): Promise<any[]> {
      return [];
    }
  },
}));

vi.mock('../../../src/services/chat/conversationStateMachine', () => ({
  ConversationStateMachine: class {
    async getState() {
      return fsmMocks.getState();
    }
    async transition(userId: string, event: string, data?: any) {
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
    vi.mocked(prisma.categoryMapping.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.categoryMapping.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.categoryMapping.create).mockResolvedValue({} as any);
    vi.mocked(prisma.categoryMapping.update).mockResolvedValue({} as any);
    vi.mocked(prisma.pendingConfirmation.create).mockResolvedValue({
      id: 'pending-1',
      type: 'transaction',
      data: '{}',
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.budget.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return fn({
          transaction: {
            create: vi.fn(),
          },
        });
      }
      return fn;
    });
  });

  it('routes "Monthly summary" to spending analytics response', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      timezone: 'Asia/Kolkata',
    } as any);

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { amount: 400, category: 'Food', type: 'EXPENSE' },
      { amount: 600, category: 'Transport', type: 'EXPENSE' },
    ] as any);

    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm1',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', 'Monthly summary');

    expect(prisma.transaction.findMany).toHaveBeenCalled();
    expect(result.message.toLowerCase()).toContain('spent');
    expect(result.message).toContain('₹1,000');
    expect(result.message.toLowerCase()).toContain('this month');
    expect(result.suggestedChips).toEqual([]);
  });

  it('parses multi-line expense lists into a pending bulk confirmation', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm1',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage(
      'user-1',
      'netflix 500\nhotstar 300\nyoutube 300'
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect((result.confirmationCard?.data as any).items).toHaveLength(3);
    expect(result.message).toContain('₹1,100');
    expect(result.message).toContain('Confirm all');
    expect(result.suggestedChips).toEqual([]);
  });

  it('parses single-line amount-first bulk entries into a pending bulk confirmation', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm1b',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage(
      'user-1',
      '500 dosa 30 chai 400 coffee 20 auto'
    );

    const items = (result.confirmationCard?.data as any).items;
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(items).toHaveLength(4);
    expect(result.message).toContain('₹950');
    expect(items.map((item: any) => item.description)).toEqual(['dosa', 'chai', 'coffee', 'auto']);
    expect(result.suggestedChips).toEqual([]);
  });

  it.each([
    ['coffee 400', 'coffee', 400],
    ['chai 60', 'chai', 60],
    ['lunch 500', 'lunch', 500],
    ['500 lunch', 'lunch', 500],
  ])('parses single shorthand "%s" into a pending transaction confirmation', async (message, description, amount) => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm1c',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', message);

    expect(result.confirmationCard?.type).toBe('transaction');
    expect((result.confirmationCard?.data as any).description).toBe(description);
    expect((result.confirmationCard?.data as any).amount).toBe(amount);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps natural expense commands as pending transaction confirmations', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm1d',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', 'spent 400 on burger');

    expect(result.confirmationCard?.type).toBe('transaction');
    expect((result.confirmationCard?.data as any).description).toBe('burger');
    expect((result.confirmationCard?.data as any).amount).toBe(400);
  });

  it('keeps multi-item amount-first commands on the bulk confirmation path', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm1e',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', '500 coffee 300 chai 800 burger');

    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect((result.confirmationCard?.data as any).items).toHaveLength(3);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('parses income list header into a pending bulk confirmation', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm2',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage(
      'user-1',
      'income:\nsalary 60000\nfreelance 15000'
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect((result.confirmationCard?.data as any).items).toHaveLength(2);
    expect(result.message).toContain('₹75,000');
  });

  it('parses mixed Income/Expense headers with amount-first expense lines', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm3',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage(
      'user-1',
      'Income:\nsalary 70000\nfreelance 15000\nmubasha 2000\n\nExpense:\n500 coffee\n400 book\n300 sandwich'
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect((result.confirmationCard?.data as any).items).toHaveLength(6);
    expect((result.confirmationCard?.data as any).skippedLines).toEqual([]);
  });

  it('supports third header blocks like Investment without skipping header lines', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm4',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage(
      'user-1',
      'Income:\nsalary 70000\nfreelance 15000\nmubasha 2000\n\nExpense:\n500 coffee\n400 book\n300 sandwich\n\nInvestment:\n5000 SIP'
    );

    const items = (result.confirmationCard?.data as any).items;
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.confirmationCard?.type).toBe('bulk_transaction');
    expect(items).toHaveLength(7);
    expect((result.confirmationCard?.data as any).skippedLines).toEqual([]);
    expect(items[6].description).toBe('SIP');
    expect(items[6].category).toBe('Investment');
  });

  it('categorizes single-line SIP entries as Investment instead of Miscellaneous', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm5',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', '500 SIP');

    expect(result.confirmationCard).not.toBeNull();
    expect(result.confirmationCard?.type).toBe('transaction');
    expect((result.confirmationCard?.data as any).category).toBe('Investment');
    expect(result.message).toContain('Investment');
  });

  it('treats dividend-style entries as income and categorizes them as Investment', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm6',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', 'dividend 500');

    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).type).toBe('income');
    expect((result.confirmationCard?.data as any).category).toBe('Investment');
    expect(result.message).toContain('Investment');
  });

  it('starts expense capture mode instead of creating a fake quick-action transaction', async () => {
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm7',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

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
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm8',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', '400 burger');

    expect(result.confirmationCard).not.toBeNull();
    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect((result.confirmationCard?.data as any).amount).toBe(400);
    expect((result.confirmationCard?.data as any).description).toBe('burger');
    expect((result.confirmationCard?.data as any).category).toBe('Food');
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
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 400,
        description: 'burger',
        category: 'Food',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm9',
      role: 'USER',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', 'change amount to 500 category Transport');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).amount).toBe(500);
    expect((result.confirmationCard?.data as any).category).toBe('Transport');
    expect(fsmMocks.resetToIdle).not.toHaveBeenCalled();
    expect(fsmMocks.transition).toHaveBeenCalledWith(
      'user-1',
      'EDIT_APPLIED',
      { pendingConfirmationId: 'pending-1' }
    );
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
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm10',
      role: 'USER',
      content: 'Edit',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', 'Edit');

    expect(result.conversationState).toBe('AWAITING_EDIT_DETAILS');
    expect(result.message).toContain('What would you like to edit');
    expect(result.suggestedChips).toEqual([]);
    expect(fsmMocks.transition).toHaveBeenCalledWith(
      'user-1',
      'EDIT_REQUESTED',
      { pendingConfirmationId: 'pending-1' }
    );
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
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 400,
        description: 'burger',
        category: 'Food',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm11',
      role: 'USER',
      content: '300 noodles',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', '300 noodles');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).amount).toBe(300);
    expect((result.confirmationCard?.data as any).description).toBe('noodles');
    expect((result.confirmationCard?.data as any).category).toBe('Miscellaneous');
    expect(fsmMocks.transition).toHaveBeenCalledWith(
      'user-1',
      'EDIT_APPLIED',
      { pendingConfirmationId: 'pending-1' }
    );
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
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 400,
        description: 'burger',
        category: 'Miscellaneous',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm12',
      role: 'USER',
      content: 'category Food',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', 'category Food');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).amount).toBe(400);
    expect((result.confirmationCard?.data as any).description).toBe('burger');
    expect((result.confirmationCard?.data as any).category).toBe('Food');
  });

  it('recalculates category when edited description changes without explicit category', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 200,
        description: 'autp',
        category: 'Food',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);

    const result = await service.editAction('user-1', 'pending-1', { description: 'auto' });

    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).description).toBe('auto');
    expect((result.confirmationCard?.data as any).category).toBe('Transport');
  });

  it('recalculates category to Transport when edited description changes to Cab', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 200,
        description: 'misc',
        category: 'Food',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);

    const result = await service.editAction('user-1', 'pending-1', { description: 'Cab' });

    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).description).toBe('Cab');
    expect((result.confirmationCard?.data as any).category).toBe('Transport');
  });

  it('does not recalculate category when category is explicitly edited', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 200,
        description: 'autp',
        category: 'Miscellaneous',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);

    const result = await service.editAction('user-1', 'pending-1', {
      description: 'auto',
      category: 'Food',
    });

    expect(result.confirmationCard).not.toBeNull();
    expect((result.confirmationCard?.data as any).description).toBe('auto');
    expect((result.confirmationCard?.data as any).category).toBe('Food');
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
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm13',
      role: 'USER',
      content: '300 noodles',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', '300 noodles');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.message).toBe('You already have a pending transaction. Please Confirm, Cancel, or Edit it first.');
    expect(result.suggestedChips).toEqual([]);
    expect(prisma.pendingConfirmation.create).not.toHaveBeenCalled();
  });

  it('persists assistant success message when confirming a transaction', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 500,
        description: 'chai',
        category: 'Food',
        type: 'expense',
        date: null,
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm14',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.confirmAction('user-1', 'pending-1');

    expect(result.message).toContain('Logged ₹500 as Food');
    expect(result.message).toContain('chai · Today');
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        role: 'ASSISTANT',
        content: result.message,
        intent: 'LOG_EXPENSE',
      }),
    });
  });

  it('confirms pending bulk transactions and persists the success summary', async () => {
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-bulk',
      userId: 'user-1',
      type: 'bulk_transaction',
      data: JSON.stringify({
        items: [
          { amount: 500, description: 'chai', category: 'Food', type: 'expense', date: null },
          { amount: 300, description: 'coffee', category: 'Food', type: 'expense', date: null },
        ],
        skippedLines: [],
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.create).mockResolvedValue({
      id: 'm15',
      role: 'ASSISTANT',
      content: 'ok',
      createdAt: new Date(),
    } as any);

    const result = await service.confirmAction('user-1', 'pending-bulk');

    expect(prisma.$transaction).toHaveBeenCalled();
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
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-1',
      userId: 'user-1',
      type: 'transaction',
      data: JSON.stringify({
        amount: 400,
        description: 'coffee',
        category: 'Food',
        type: 'expense',
        date: null,
        sourceUserMessageId: 'user-msg-1',
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.updateMany).mockResolvedValue({ count: 1 } as any);

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
    vi.mocked(prisma.pendingConfirmation.findFirst).mockResolvedValue({
      id: 'pending-bulk',
      userId: 'user-1',
      type: 'bulk_transaction',
      data: JSON.stringify({
        items: [
          { amount: 500, description: 'coffee', category: 'Food', type: 'expense', date: null },
          { amount: 300, description: 'chai', category: 'Food', type: 'expense', date: null },
        ],
        skippedLines: [],
        sourceUserMessageId: 'bulk-user-msg',
      }),
      status: 'PENDING',
    } as any);
    vi.mocked(prisma.pendingConfirmation.update).mockResolvedValue({} as any);
    vi.mocked(prisma.chatMessage.updateMany).mockResolvedValue({ count: 1 } as any);

    const result = await service.cancelAction('user-1', 'pending-bulk');

    expect(result.message).toBe('');
    expect(result.metadata).toBe(JSON.stringify({ hiddenMessageId: 'bulk-user-msg' }));
    expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bulk-user-msg', userId: 'user-1', role: 'USER' },
    }));
  });

  it('returns latest chat history in chronological display order', async () => {
    const newest = { id: 'm3', role: 'ASSISTANT', content: 'newest', createdAt: new Date('2026-01-03') };
    const middle = { id: 'm2', role: 'USER', content: 'middle', createdAt: new Date('2026-01-02') };
    const oldestOfPage = { id: 'm1', role: 'ASSISTANT', content: 'oldest of page', createdAt: new Date('2026-01-01') };
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([newest, middle, oldestOfPage] as any);

    const result = await service.getHistory('user-1', 3, 0);

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', role: { not: 'SYSTEM' }, pendingConfirmation: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
      skip: 0,
    }));
    expect(result.map((message) => message.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('excludes hidden cancelled-command messages from chat history', async () => {
    const visible = { id: 'm2', role: 'ASSISTANT', content: 'visible', metadata: null, createdAt: new Date('2026-01-02') };
    const hidden = {
      id: 'm1',
      role: 'USER',
      content: 'coffee 400',
      metadata: JSON.stringify({ hiddenFromChat: true, hiddenReason: 'cancelled_confirmation' }),
      createdAt: new Date('2026-01-01'),
    };
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([visible, hidden] as any);

    const result = await service.getHistory('user-1', 50, 0);

    expect(result.map((message) => message.id)).toEqual(['m2']);
  });
});
