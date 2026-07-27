import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionService } from '../../src/services/transactionService';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/database', () => ({
  default: mockPrisma,
}));

describe('TransactionService', () => {
  let service: TransactionService;

  beforeEach(() => {
    service = new TransactionService();
    vi.clearAllMocks();
  });

  it('creates a transaction with user include and date conversion', async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: 't1' });

    await service.createTransaction('u1', {
      amount: 1200,
      description: 'Groceries',
      category: 'Food',
      type: 'EXPENSE',
      date: '2026-03-01',
    });

    expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        amount: 1200,
        description: 'Groceries',
        category: 'Food',
        categoryKey: 'food-dining',
        type: 'EXPENSE',
        source: 'manual',
        date: new Date('2026-03-01'),
      }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  });

  it('returns paginated transactions payload', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([{ id: 't1' }]);
    mockPrisma.transaction.count.mockResolvedValue(1);

    const result = await service.getTransactions('u1', { page: 1, limit: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 't1' }]);
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('returns a transaction by id when found', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 't1', userId: 'u1' });

    const result = await service.getTransactionById('u1', 't1');

    expect(result.id).toBe('t1');
    expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: 't1', userId: 'u1' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  });

  it('throws if transaction is missing', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue(null);
    await expect(service.getTransactionById('u1', 'missing')).rejects.toThrow('Transaction not found');
  });

  it('updates an existing transaction', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      category: 'Food & Dining',
      type: 'EXPENSE',
    });
    mockPrisma.transaction.update.mockResolvedValue({ id: 't1', amount: 1500 });

    const result = await service.updateTransaction('u1', 't1', { amount: 1500 });

    expect(result).toMatchObject({ id: 't1', amount: 1500 });
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { amount: 1500, categoryKey: 'food-dining' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  });

  it.each([
    ['category', { category: 'Transportation' }, { category: 'Transportation', categoryKey: 'transportation' }],
    ['type', { type: 'INCOME' as const }, { type: 'INCOME', categoryKey: null }],
    ['date', { date: '2026-04-01' }, { date: new Date('2026-04-01'), categoryKey: 'food-dining' }],
  ])('recalculates categoryKey when %s changes', async (_field, update, expectedData) => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      category: 'Food & Dining',
      type: 'EXPENSE',
    });
    mockPrisma.transaction.update.mockResolvedValue({ id: 't1' });

    await service.updateTransaction('u1', 't1', update);

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expectedData })
    );
  });

  it('leaves unknown categories unassociated', async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: 't-unknown' });

    await service.createTransaction('u1', {
      amount: 99,
      description: 'Unmapped expense',
      category: 'Unrecognized category',
      type: 'EXPENSE',
      date: '2026-03-01',
    });

    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryKey: null }),
      })
    );
  });

  it('deletes an existing transaction', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 't1', userId: 'u1' });
    mockPrisma.transaction.delete.mockResolvedValue({ id: 't1' });

    const result = await service.deleteTransaction('u1', 't1');

    expect(result).toEqual({ success: true, message: 'Transaction deleted successfully' });
    expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });

  it('searches transactions and returns formatted results', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 't1',
        amount: 500,
        description: 'Tea',
        category: 'Food',
        type: 'EXPENSE',
        date: new Date('2026-03-01'),
      },
    ]);

    const result = await service.searchTransactions('u1', 'tea', 5);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 't1',
      type: 'transaction',
      title: 'Tea',
      category: 'Food',
    });
  });
});
