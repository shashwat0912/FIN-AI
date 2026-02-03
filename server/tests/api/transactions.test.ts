import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import prisma from '../../src/config/database';

// Mock the database
vi.mock('../../src/config/database', () => ({
  default: {
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

describe('Transaction API Routes', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Mock authenticated user
    userId = 'test-user-id';
    authToken = 'mock-jwt-token';
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  describe('POST /api/v1/transactions', () => {
    it('should create a transaction successfully', async () => {
      const transactionData = {
        amount: 1000,
        description: 'Test transaction',
        category: 'Food',
        type: 'EXPENSE',
        date: '2024-01-01',
      };

      const mockTransaction = {
        id: '1',
        ...transactionData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction);

      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransaction);
      expect(response.body.message).toBe('Transaction created successfully');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        amount: 'invalid',
        description: '',
        category: '',
        type: 'INVALID',
        date: 'invalid-date',
      };

      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });

    it('should return 401 for missing authentication', async () => {
      const transactionData = {
        amount: 1000,
        description: 'Test transaction',
        category: 'Food',
        type: 'EXPENSE',
        date: '2024-01-01',
      };

      await request(app)
        .post('/api/v1/transactions')
        .send(transactionData)
        .expect(401);
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('should get transactions with pagination', async () => {
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

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
      vi.mocked(prisma.transaction.count).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/transactions?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransactions);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter transactions by category', async () => {
      const mockTransactions = [
        {
          id: '1',
          amount: 1000,
          description: 'Food transaction',
          category: 'Food',
          type: 'EXPENSE',
          date: '2024-01-01',
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
      vi.mocked(prisma.transaction.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/transactions?category=Food')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransactions);
    });

    it('should filter transactions by date range', async () => {
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

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);
      vi.mocked(prisma.transaction.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/transactions?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransactions);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should get transaction by ID', async () => {
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

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction);

      const response = await request(app)
        .get(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransaction);
    });

    it('should return 404 for non-existent transaction', async () => {
      const transactionId = 'nonexistent';

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction not found');
    });
  });

  describe('PUT /api/v1/transactions/:id', () => {
    it('should update transaction successfully', async () => {
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

      vi.mocked(prisma.transaction.update).mockResolvedValue(mockTransaction);

      const response = await request(app)
        .put(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransaction);
      expect(response.body.message).toBe('Transaction updated successfully');
    });

    it('should return 404 for non-existent transaction', async () => {
      const transactionId = 'nonexistent';
      const updateData = { amount: 1500 };

      vi.mocked(prisma.transaction.update).mockRejectedValue(
        new Error('Record to update not found')
      );

      const response = await request(app)
        .put(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction not found');
    });
  });

  describe('DELETE /api/v1/transactions/:id', () => {
    it('should delete transaction successfully', async () => {
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

      vi.mocked(prisma.transaction.delete).mockResolvedValue(mockTransaction);

      const response = await request(app)
        .delete(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Transaction deleted successfully');
    });

    it('should return 404 for non-existent transaction', async () => {
      const transactionId = 'nonexistent';

      vi.mocked(prisma.transaction.delete).mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      const response = await request(app)
        .delete(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction not found');
    });
  });

  describe('GET /api/v1/transactions/search', () => {
    it('should search transactions successfully', async () => {
      const query = 'test';
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

      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions);

      const response = await request(app)
        .get(`/api/v1/transactions/search?q=${query}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTransactions);
    });

    it('should return error for missing search query', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Search query is required');
    });
  });

  describe('GET /api/v1/transactions/balance', () => {
    it('should get balance successfully', async () => {
      const mockAggregate = {
        _sum: {
          amount: 500,
        },
      };

      vi.mocked(prisma.transaction.aggregate).mockResolvedValue(mockAggregate);

      const response = await request(app)
        .get('/api/v1/transactions/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(500);
    });

    it('should return 0 balance when no transactions', async () => {
      const mockAggregate = {
        _sum: {
          amount: null,
        },
      };

      vi.mocked(prisma.transaction.aggregate).mockResolvedValue(mockAggregate);

      const response = await request(app)
        .get('/api/v1/transactions/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(0);
    });
  });
});













