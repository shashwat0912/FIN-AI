import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AiService } from '../../src/services/aiService';
import { PrismaClient } from '@prisma/client';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

vi.mock('openai', () => ({
  OpenAI: vi.fn(() => mockOpenAI),
}));

// Mock Prisma
const mockPrisma = {
  aiSession: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  $disconnect: vi.fn(),
} as unknown as PrismaClient;

// Mock config
vi.mock('../../src/config/env', () => ({
  config: {
    OPENAI_API_KEY: 'test-api-key',
    NODE_ENV: 'test',
  },
}));

describe('AiService', () => {
  let aiService: AiService;

  beforeEach(() => {
    aiService = new AiService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdvice', () => {
    it('should get AI advice successfully', async () => {
      const query = 'How should I invest my money?';
      const context = {
        currentBalance: 10000,
        monthlyIncome: 5000,
        monthlyExpenses: 3000,
        goals: ['retirement', 'house'],
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: 'Based on your financial situation, I recommend diversifying your investments...',
            },
          },
        ],
      };

      const mockSession = {
        id: '1',
        query,
        response: mockOpenAIResponse.choices[0].message.content,
        category: 'investment',
        userId: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockOpenAIResponse);
      vi.mocked(mockPrisma.aiSession.create).mockResolvedValue(mockSession);

      const result = await aiService.getAdvice(query, context, '1');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('financial advisor'),
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(query),
          }),
        ]),
        max_tokens: 500,
        temperature: 0.7,
      });

      expect(mockPrisma.aiSession.create).toHaveBeenCalledWith({
        data: {
          query,
          response: mockOpenAIResponse.choices[0].message.content,
          category: expect.any(String),
          userId: '1',
        },
      });

      expect(result.advice).toBe(mockOpenAIResponse.choices[0].message.content);
      expect(result.category).toBeDefined();
    });

    it('should handle OpenAI API errors', async () => {
      const query = 'How should I invest my money?';
      const context = {};

      vi.mocked(mockOpenAI.chat.completions.create).mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(aiService.getAdvice(query, context, '1'))
        .rejects
        .toThrow('Failed to get AI advice');
    });

    it('should categorize advice correctly', async () => {
      const testCases = [
        {
          query: 'How should I invest in stocks?',
          expectedCategory: 'investment',
        },
        {
          query: 'What insurance should I get?',
          expectedCategory: 'insurance',
        },
        {
          query: 'How can I save more money?',
          expectedCategory: 'savings',
        },
        {
          query: 'How to budget my expenses?',
          expectedCategory: 'budgeting',
        },
      ];

      for (const testCase of testCases) {
        const mockOpenAIResponse = {
          choices: [
            {
              message: {
                content: 'Test advice content',
              },
            },
          ],
        };

        vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockOpenAIResponse);
        vi.mocked(mockPrisma.aiSession.create).mockImplementation(({ data }) =>
          Promise.resolve({
            id: '1',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        );

        const result = await aiService.getAdvice(testCase.query, {}, '1');

        expect(result.category).toBe(testCase.expectedCategory);
      }
    });

    it('should use context in prompt when provided', async () => {
      const query = 'How should I invest?';
      const context = {
        currentBalance: 50000,
        monthlyIncome: 8000,
        monthlyExpenses: 4000,
        goals: ['retirement'],
      };

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: 'Based on your high income and low expenses...',
            },
          },
        ],
      };

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockOpenAIResponse);
      vi.mocked(mockPrisma.aiSession.create).mockResolvedValue({
        id: '1',
        query,
        response: mockOpenAIResponse.choices[0].message.content,
        category: 'investment',
        userId: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await aiService.getAdvice(query, context, '1');

      const callArgs = vi.mocked(mockOpenAI.chat.completions.create).mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');

      expect(userMessage.content).toContain('Current Balance: $50,000');
      expect(userMessage.content).toContain('Monthly Income: $8,000');
      expect(userMessage.content).toContain('Monthly Expenses: $4,000');
      expect(userMessage.content).toContain('Goals: retirement');
    });
  });

  describe('getHistory', () => {
    it('should get AI history successfully', async () => {
      const userId = '1';
      const limit = 10;

      const mockHistory = [
        {
          id: '1',
          query: 'How to invest?',
          response: 'Investment advice...',
          category: 'investment',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          query: 'Budgeting tips?',
          response: 'Budgeting advice...',
          category: 'budgeting',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockPrisma.aiSession.findMany).mockResolvedValue(mockHistory);

      const result = await aiService.getHistory(userId, limit);

      expect(mockPrisma.aiSession.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      expect(result).toEqual(mockHistory);
    });

    it('should return empty array if no history', async () => {
      const userId = '1';
      const limit = 10;

      vi.mocked(mockPrisma.aiSession.findMany).mockResolvedValue([]);

      const result = await aiService.getHistory(userId, limit);

      expect(result).toEqual([]);
    });

    it('should use default limit if not provided', async () => {
      const userId = '1';

      vi.mocked(mockPrisma.aiSession.findMany).mockResolvedValue([]);

      await aiService.getHistory(userId);

      expect(mockPrisma.aiSession.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20, // Default limit
      });
    });
  });

  describe('getSessionById', () => {
    it('should get session by ID successfully', async () => {
      const sessionId = '1';
      const userId = '1';

      const mockSession = {
        id: sessionId,
        query: 'How to invest?',
        response: 'Investment advice...',
        category: 'investment',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.aiSession.findFirst).mockResolvedValue(mockSession);

      const result = await aiService.getSessionById(sessionId, userId);

      expect(mockPrisma.aiSession.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId, userId },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null if session not found', async () => {
      const sessionId = 'nonexistent';
      const userId = '1';

      vi.mocked(mockPrisma.aiSession.findFirst).mockResolvedValue(null);

      const result = await aiService.getSessionById(sessionId, userId);

      expect(result).toBeNull();
    });
  });

  describe('categorizeAdvice', () => {
    it('should categorize investment advice correctly', () => {
      const investmentQueries = [
        'How should I invest my money?',
        'What stocks should I buy?',
        'Should I invest in mutual funds?',
        'Portfolio diversification advice',
      ];

      for (const query of investmentQueries) {
        const category = (aiService as any).categorizeAdvice(query);
        expect(category).toBe('investment');
      }
    });

    it('should categorize insurance advice correctly', () => {
      const insuranceQueries = [
        'What insurance should I get?',
        'Life insurance recommendations',
        'Health insurance options',
        'Should I get term insurance?',
      ];

      for (const query of insuranceQueries) {
        const category = (aiService as any).categorizeAdvice(query);
        expect(category).toBe('insurance');
      }
    });

    it('should categorize savings advice correctly', () => {
      const savingsQueries = [
        'How can I save more money?',
        'Emergency fund advice',
        'Savings account recommendations',
        'How to build savings?',
      ];

      for (const query of savingsQueries) {
        const category = (aiService as any).categorizeAdvice(query);
        expect(category).toBe('savings');
      }
    });

    it('should categorize budgeting advice correctly', () => {
      const budgetingQueries = [
        'How to budget my expenses?',
        'Budget planning tips',
        'Expense tracking advice',
        'How to reduce spending?',
      ];

      for (const query of budgetingQueries) {
        const category = (aiService as any).categorizeAdvice(query);
        expect(category).toBe('budgeting');
      }
    });

    it('should default to budgeting for unknown queries', () => {
      const unknownQueries = [
        'Random question',
        'What is the weather?',
        'General advice',
      ];

      for (const query of unknownQueries) {
        const category = (aiService as any).categorizeAdvice(query);
        expect(category).toBe('budgeting');
      }
    });
  });
});













