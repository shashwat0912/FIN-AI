import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      return { state: 'IDLE' };
    }
    async transition() {
      return { state: 'IDLE' };
    }
    async resetToIdle() {
      return { state: 'IDLE' };
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
    expect(result.suggestedChips.length).toBeGreaterThan(0);
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
});
