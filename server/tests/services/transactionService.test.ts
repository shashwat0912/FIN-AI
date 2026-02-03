import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransactionService } from '../../src/services/transactionService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  transaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  $disconnect: vi.fn(),
} as unknown as PrismaClient;

// Mock config
vi.mock('../../src/config/env', () => ({
  config: {
    NODE_ENV: 'test',
  },
}));

describe('TransactionService', () => {
  let transactionService: TransactionService;

  beforeEach(() => {
    transactionService = new TransactionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTransaction', () => {
    it('should create a transaction successfully', async () => {
      const userId = '1';
      const transactionData = {
        amount: 1000,
        description: 'Test transaction',
        category: 'Food',
        type: 'EXPENSE' as const,
        date: '2024-01-01',
      };

      const mockTransaction = {
        id: '1',
        ...transactionData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.transaction.create).mockResolvedValue(mockTransaction);

      const result = await transactionService.createTransaction(userId, transactionData);

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          ...transactionData,
          userId,
        },
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should handle negative amounts for expenses', async () => {
      const userId = '1';
      const transactionData = {
        amount: -500,
        description: 'Test expense',
        category: 'Food',
        type: 'EXPENSE' as const,
        date: '2024-01-01',
      };

      const mockTransaction = {
        id: '1',
        ...transactionData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.transaction.create).mockResolvedValue(mockTransaction);

      const result = await transactionService.createTransaction(userId, transactionData);

      expect(result.amount).toBe(-500);
    });
  });

  describe('getTransactions', () => {
    it('should get transactions with pagination', async () => {
      const userId = '1';
      const page = 1;
      const limit = 10;

      const mockTransactions = [
        {
          id: '1',
          amount: 1000,
          description: 'Test transaction 1',
          category: 'Food',
          type: 'EXPENSE',
          date: '2024-01-01',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          amount: 2000,
          description: 'Test transaction 2',
          category: 'Salary',
          type: 'INCOME',
          date: '2024-01-02',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue(mockTransactions);
      vi.mocked(mockPrisma.transaction.count).mockResolvedValue(2);

      const result = await transactionService.getTransactions(userId, page, limit);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.transactions).toEqual(mockTransactions);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter transactions by category', async () => {
      const userId = '1';
      const category = 'Food';

      const mockTransactions = [
        {
          id: '1',
          amount: 1000,
          description: 'Test transaction',
          category: 'Food',
          type: 'EXPENSE',
          date: '2024-01-01',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue(mockTransactions);
      vi.mocked(mockPrisma.transaction.count).mockResolvedValue(1);

      const result = await transactionService.getTransactions(userId, 1, 10, category);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId, category },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.transactions).toEqual(mockTransactions);
    });

    it('should filter transactions by date range', async () => {
      const userId = '1';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const mockTransactions = [
        {
          id: '1',
          amount: 1000,
          description: 'Test transaction',
          category: 'Food',
          type: 'EXPENSE',
          date: '2024-01-15',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue(mockTransactions);
      vi.mocked(mockPrisma.transaction.count).mockResolvedValue(1);

      const result = await transactionService.getTransactions(userId, 1, 10, undefined, startDate, endDate);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.transactions).toEqual(mockTransactions);
    });
  });

  describe('getTransactionById', () => {
    it('should get transaction by ID', async () => {
      const userId = '1';
      const transactionId = '1';

      const mockTransaction = {
        id: transactionId,
        amount: 1000,
        description: 'Test transaction',
        category: 'Food',
        type: 'EXPENSE',
        date: '2024-01-01',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.transaction.findUnique).mockResolvedValue(mockTransaction);

      const result = await transactionService.getTransactionById(userId, transactionId);

      expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: transactionId, userId },
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if transaction not found', async () => {
      const userId = '1';
      const transactionId = 'nonexistent';

      vi.mocked(mockPrisma.transaction.findUnique).mockResolvedValue(null);

      const result = await transactionService.getTransactionById(userId, transactionId);

      expect(result).toBeNull();
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction successfully', async () => {
      const userId = '1';
      const transactionId = '1';
      const updateData = {
        amount: 1500,
        description: 'Updated transaction',
        category: 'Entertainment',
      };

      const mockTransaction = {
        id: transactionId,
        amount: updateData.amount,
        description: updateData.description,
        category: updateData.category,
        type: 'EXPENSE',
        date: '2024-01-01',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.transaction.update).mockResolvedValue(mockTransaction);

      const result = await transactionService.updateTransaction(userId, transactionId, updateData);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId, userId },
        data: updateData,
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw error if transaction not found', async () => {
      const userId = '1';
      const transactionId = 'nonexistent';
      const updateData = { amount: 1500 };

      vi.mocked(mockPrisma.transaction.update).mockRejectedValue(
        new Error('Record to update not found')
      );

      await expect(transactionService.updateTransaction(userId, transactionId, updateData))
        .rejects
        .toThrow('Transaction not found');
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction successfully', async () => {
      const userId = '1';
      const transactionId = '1';

      const mockTransaction = {
        id: transactionId,
        amount: 1000,
        description: 'Test transaction',
        category: 'Food',
        type: 'EXPENSE',
        date: '2024-01-01',
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.transaction.delete).mockResolvedValue(mockTransaction);

      const result = await transactionService.deleteTransaction(userId, transactionId);

      expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: transactionId, userId },
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw error if transaction not found', async () => {
      const userId = '1';
      const transactionId = 'nonexistent';

      vi.mocked(mockPrisma.transaction.delete).mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      await expect(transactionService.deleteTransaction(userId, transactionId))
        .rejects
        .toThrow('Transaction not found');
    });
  });

  describe('getBalance', () => {
    it('should calculate balance correctly', async () => {
      const userId = '1';

      const mockAggregate = {
        _sum: {
          amount: 500, // Net positive balance
        },
      };

      vi.mocked(mockPrisma.transaction.aggregate).mockResolvedValue(mockAggregate);

      const result = await transactionService.getBalance(userId);

      expect(mockPrisma.transaction.aggregate).toHaveBeenCalledWith({
        where: { userId },
        _sum: { amount: true },
      });
      expect(result).toBe(500);
    });

    it('should return 0 if no transactions', async () => {
      const userId = '1';

      const mockAggregate = {
        _sum: {
          amount: null,
        },
      };

      vi.mocked(mockPrisma.transaction.aggregate).mockResolvedValue(mockAggregate);

      const result = await transactionService.getBalance(userId);

      expect(result).toBe(0);
    });
  });

  describe('searchTransactions', () => {
    it('should search transactions by description', async () => {
      const userId = '1';
      const query = 'test';
      const limit = 10;

      const mockTransactions = [
        {
          id: '1',
          amount: 1000,
          description: 'Test transaction',
          category: 'Food',
          type: 'EXPENSE',
          date: '2024-01-01',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue(mockTransactions);

      const result = await transactionService.searchTransactions(userId, query, limit);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { description: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array if no matches found', async () => {
      const userId = '1';
      const query = 'nonexistent';
      const limit = 10;

      vi.mocked(mockPrisma.transaction.findMany).mockResolvedValue([]);

      const result = await transactionService.searchTransactions(userId, query, limit);

      expect(result).toEqual([]);
    });
  });
});













