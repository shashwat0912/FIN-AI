import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../src/services/aiService';

const {
  mockOpenAiCreate,
  mockRetrieveContext,
  mockBuildGroundedAdvicePrompt,
  mockPrisma,
} = vi.hoisted(() => ({
  mockOpenAiCreate: vi.fn(),
  mockRetrieveContext: vi.fn(),
  mockBuildGroundedAdvicePrompt: vi.fn(),
  mockPrisma: {
    aiSession: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    goal: {
      findMany: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: mockOpenAiCreate,
      },
    },
  })),
}));

vi.mock('../../src/services/ragService', () => ({
  RAGService: vi.fn(() => ({
    retrieveContext: mockRetrieveContext,
    buildGroundedAdvicePrompt: mockBuildGroundedAdvicePrompt,
  })),
}));

vi.mock('../../src/config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../src/config/openai', () => ({
  hasUsableOpenAiKey: vi.fn(() => true),
}));

vi.mock('../../src/config/env', () => ({
  config: {
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_MAX_TOKENS: 500,
    OPENAI_TIMEOUT_MS: 12000,
    AI_PROVIDER: 'auto',
  },
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiService();

    mockRetrieveContext.mockResolvedValue([
      { content: 'Emergency fund should cover 3-6 months', similarity: 0.89 },
    ]);
    mockBuildGroundedAdvicePrompt.mockReturnValue('grounded prompt');
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.goal.findMany.mockResolvedValue([]);
    mockPrisma.budget.findMany.mockResolvedValue([]);
    mockPrisma.aiSession.create.mockResolvedValue({
      id: 's1',
      category: 'savings',
    });
  });

  it('generates RAG-grounded financial advice and stores session', async () => {
    mockOpenAiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Start SIP and build emergency fund.' } }],
    });

    const result = await service.getFinancialAdvice('user-1', {
      query: 'How can I save more money?',
    });

    expect(mockRetrieveContext).toHaveBeenCalledWith(
      'How can I save more money?',
      expect.objectContaining({
        topK: 4,
        jurisdiction: 'india',
      })
    );
    expect(mockBuildGroundedAdvicePrompt).toHaveBeenCalled();
    expect(mockOpenAiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.4,
      })
    );
    expect(mockPrisma.aiSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        query: 'How can I save more money?',
        response: 'Start SIP and build emergency fund.',
        userId: 'user-1',
      }),
    });
    expect(result.advice).toContain('Start SIP');
  });

  it('falls back to mock advice if OpenAI fails', async () => {
    mockOpenAiCreate.mockRejectedValue(new Error('OpenAI down'));

    const result = await service.getFinancialAdvice('user-1', {
      query: 'How should I invest?',
    });

    expect(result.advice.length).toBeGreaterThan(0);
    expect(mockPrisma.aiSession.create).toHaveBeenCalled();
  });

  it('returns AI session history', async () => {
    mockPrisma.aiSession.findMany.mockResolvedValue([
      { id: '1', query: 'q1', response: 'r1', category: 'budgeting', createdAt: new Date() },
    ]);

    const result = await service.getAiHistory('user-1', 5);

    expect(mockPrisma.aiSession.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        query: true,
        response: true,
        category: true,
        createdAt: true,
      },
    });
    expect(result).toHaveLength(1);
  });

  it('deletes an existing AI session', async () => {
    mockPrisma.aiSession.findFirst.mockResolvedValue({ id: 's1', userId: 'user-1' });
    mockPrisma.aiSession.delete.mockResolvedValue({ id: 's1' });

    const result = await service.deleteAiSession('user-1', 's1');

    expect(mockPrisma.aiSession.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(result).toEqual({ success: true, message: 'AI session deleted successfully' });
  });

  it('throws when deleting missing AI session', async () => {
    mockPrisma.aiSession.findFirst.mockResolvedValue(null);

    await expect(service.deleteAiSession('user-1', 'missing')).rejects.toThrow('AI session not found');
  });
});
