import { Budget, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type LedgerEntry = {
  id: string;
  userId: string;
  type: string;
  categoryKey: string | null;
  amount: Prisma.Decimal;
  date: Date;
};

type BudgetGroupByArgs = {
  where: {
    userId: string;
    type: string;
    categoryKey: { in: string[] };
    date: { gte: Date; lt: Date };
  };
};

const { ledger, mockPrisma } = vi.hoisted(() => ({
  ledger: [] as LedgerEntry[],
  mockPrisma: {
    user: { findUnique: vi.fn() },
    transaction: { groupBy: vi.fn() },
  },
}));

vi.mock('../../src/config/database', () => ({ default: mockPrisma }));

import {
  getBudgetPeriodRange,
  projectBudgets,
} from '../../src/services/budgetProjectionService';

const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-food',
    name: 'Food & Dining',
    categoryKey: 'food-dining',
    amount: decimal('1000.00'),
    spent: decimal('999999.99'),
    period: 'MONTHLY',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  ledger.length = 0;
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
  mockPrisma.transaction.groupBy.mockImplementation(async ({ where }: BudgetGroupByArgs) => {
    const sums = new Map<string, Prisma.Decimal>();
    for (const transaction of ledger) {
      if (
        transaction.userId !== where.userId ||
        transaction.type !== where.type ||
        !transaction.categoryKey ||
        !where.categoryKey.in.includes(transaction.categoryKey) ||
        transaction.date < where.date.gte ||
        transaction.date >= where.date.lt
      ) continue;

      const key = transaction.categoryKey as string;
      sums.set(key, (sums.get(key) || decimal(0)).plus(transaction.amount));
    }
    return [...sums].map(([categoryKey, amount]) => ({
      categoryKey,
      _sum: { amount },
    }));
  });
});

describe('budgetProjectionService', () => {
  const asOf = new Date('2026-07-15T12:00:00.000Z');

  it('uses user-local calendar periods with an inclusive start and exclusive end', () => {
    const range = getBudgetPeriodRange('MONTHLY', 'Asia/Kolkata', asOf);

    expect(range.start.toISOString()).toBe('2026-06-30T18:30:00.000Z');
    expect(range.end.toISOString()).toBe('2026-07-31T18:30:00.000Z');
  });

  it('falls back to Asia/Kolkata for an invalid timezone', () => {
    const range = getBudgetPeriodRange('MONTHLY', 'Not/A_Timezone', asOf);

    expect(range.timezone).toBe('Asia/Kolkata');
    expect(range.start.toISOString()).toBe('2026-06-30T18:30:00.000Z');
    expect(range.end.toISOString()).toBe('2026-07-31T18:30:00.000Z');
  });

  it('includes the exact period start and excludes the exact period end', async () => {
    ledger.push(
      { id: 'start', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('10'), date: new Date('2026-06-30T18:30:00.000Z') },
      { id: 'before-end', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('5'), date: new Date('2026-07-31T18:29:59.999Z') },
      { id: 'end', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('99'), date: new Date('2026-07-31T18:30:00.000Z') },
    );

    const [projection] = await projectBudgets('user-1', [budget()], { asOf });

    expect(projection.spent.toString()).toBe('15');
  });

  it('only counts matching in-period expenses for the authenticated user', async () => {
    ledger.push(
      { id: 'matching', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('120.10'), date: new Date('2026-07-10T00:00:00.000Z') },
      { id: 'income', userId: 'user-1', type: 'INCOME', categoryKey: 'food-dining', amount: decimal('800'), date: new Date('2026-07-10T00:00:00.000Z') },
      { id: 'category', userId: 'user-1', type: 'EXPENSE', categoryKey: 'transportation', amount: decimal('50'), date: new Date('2026-07-10T00:00:00.000Z') },
      { id: 'user', userId: 'user-2', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('75'), date: new Date('2026-07-10T00:00:00.000Z') },
      { id: 'outside', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('45'), date: new Date('2026-06-30T18:29:59.999Z') }
    );

    const [projection] = await projectBudgets('user-1', [budget()], { asOf });

    expect(projection.spent.toFixed(2)).toBe('120.10');
    expect(projection.remaining.toFixed(2)).toBe('879.90');
    expect(projection.utilizationPercentage.toFixed(2)).toBe('12.01');
    expect(projection.status).toBe('ON_TRACK');
    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryKey'],
      where: {
        userId: 'user-1',
        type: 'EXPENSE',
        categoryKey: { in: ['food-dining'] },
        date: {
          gte: new Date('2026-06-30T18:30:00.000Z'),
          lt: new Date('2026-07-31T18:30:00.000Z'),
        },
      },
      _sum: { amount: true },
    });
  });

  it('reflects category edits, amount edits, and deletes from ledger state', async () => {
    const entry: LedgerEntry = {
      id: 'edited', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining',
      amount: decimal('100.00'), date: new Date('2026-07-10T00:00:00.000Z'),
    };
    ledger.push(entry);
    const budgets = [
      budget(),
      budget({ id: 'budget-transport', name: 'Transportation', categoryKey: 'transportation' }),
    ];

    let projections = await projectBudgets('user-1', budgets, { asOf });
    expect(projections.map((item) => item.spent.toFixed(2))).toEqual(['100.00', '0.00']);

    entry.categoryKey = 'transportation';
    entry.amount = decimal('125.50');
    projections = await projectBudgets('user-1', budgets, { asOf });
    expect(projections.map((item) => item.spent.toFixed(2))).toEqual(['0.00', '125.50']);

    ledger.splice(ledger.indexOf(entry), 1);
    projections = await projectBudgets('user-1', budgets, { asOf });
    expect(projections.map((item) => item.spent.toFixed(2))).toEqual(['0.00', '0.00']);
  });

  it('keeps Decimal sums exact and does not associate null category keys', async () => {
    ledger.push(
      { id: 'd1', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('0.1'), date: new Date('2026-07-10T00:00:00.000Z') },
      { id: 'd2', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining', amount: decimal('0.2'), date: new Date('2026-07-10T00:00:00.000Z') },
      { id: 'legacy-null', userId: 'user-1', type: 'EXPENSE', categoryKey: null, amount: decimal('500'), date: new Date('2026-07-10T00:00:00.000Z') },
    );

    const projections = await projectBudgets('user-1', [
      budget({ amount: decimal('1.00') }),
      budget({ id: 'unknown', name: 'Unknown', categoryKey: null, amount: decimal('10.00') }),
    ], { asOf });

    expect(projections[0].spent.toString()).toBe('0.3');
    expect(projections[0].remaining.toString()).toBe('0.7');
    expect(projections[1].spent.toString()).toBe('0');
  });

  it('marks positive spend against a legacy zero limit as over budget', async () => {
    ledger.push({
      id: 'zero-limit', userId: 'user-1', type: 'EXPENSE', categoryKey: 'food-dining',
      amount: decimal('2.50'), date: new Date('2026-07-10T00:00:00.000Z'),
    });

    const [projection] = await projectBudgets('user-1', [budget({ amount: decimal(0) })], { asOf });

    expect(projection.spent.toString()).toBe('2.5');
    expect(projection.remaining.toString()).toBe('-2.5');
    expect(projection.utilizationPercentage.toString()).toBe('100');
    expect(projection.status).toBe('OVER_BUDGET');
  });

  it('runs one transaction aggregation per distinct period, not per budget', async () => {
    const budgets = Array.from({ length: 20 }, (_, index) => budget({
      id: `budget-${index}`,
      categoryKey: `category-${index}`,
    }));

    await projectBudgets('user-1', budgets, { asOf });

    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('runs one aggregation per distinct period', async () => {
    await projectBudgets('user-1', [
      budget({ id: 'weekly', period: 'WEEKLY' }),
      budget({ id: 'monthly', period: 'MONTHLY' }),
      budget({ id: 'yearly', period: 'YEARLY' }),
    ], { asOf });

    expect(mockPrisma.transaction.groupBy).toHaveBeenCalledTimes(3);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
