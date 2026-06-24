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

  it('parses multi-line expense lists and logs them as separate transactions', async () => {
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

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.message).toContain('Logged 3 expense item(s)');
    expect(result.message).toContain('₹1,100');
    expect(result.message.toLowerCase()).toContain('netflix');
    expect(result.suggestedChips).toEqual([]);
  });

  it('parses single-line amount-first bulk entries and logs them as separate transactions', async () => {
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

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.message).toContain('Logged 4 expense item(s)');
    expect(result.message).toContain('₹950');
    expect(result.message).toContain('dosa ₹500');
    expect(result.message).toContain('chai ₹30');
    expect(result.message).toContain('coffee ₹400');
    expect(result.message).toContain('auto ₹20');
    expect(result.suggestedChips).toEqual([]);
  });

  it('parses income list header and logs multiple income entries', async () => {
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

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.message).toContain('Logged 2 income item(s)');
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

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.message).toContain('Logged 6 transaction(s)');
    expect(result.message).toContain('income ₹87,000');
    expect(result.message).toContain('expense ₹1,200');
    expect(result.message).not.toContain('Skipped');
    expect(result.message).toContain('Added in order');
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

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.message).toContain('Logged 7 transaction(s)');
    expect(result.message).toContain('income ₹87,000');
    expect(result.message).toContain('expense ₹6,200');
    expect(result.message).not.toContain('"Investment:"');
    expect(result.message).not.toContain('Skipped');
    expect(result.message).toContain('SIP ₹5,000 (Investment)');
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

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.message).toContain('What would you like to edit');
    expect(result.suggestedChips).toEqual([]);
    expect(prisma.pendingConfirmation.update).not.toHaveBeenCalled();
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
      id: 'm11',
      role: 'USER',
      content: '500 coffee',
      createdAt: new Date(),
    } as any);

    const result = await service.processMessage('user-1', '500 coffee');

    expect(result.conversationState).toBe('AWAITING_CONFIRMATION');
    expect(result.message).toBe('You already have a pending transaction. Please Confirm, Cancel, or Edit it first.');
    expect(result.suggestedChips).toEqual([]);
    expect(prisma.pendingConfirmation.create).not.toHaveBeenCalled();
  });
});
