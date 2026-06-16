import prisma from '../../config/database';

export interface CashflowResult {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  topCategories: { category: string; amount: number }[];
}

/** Coerce Prisma Decimal aggregate to plain number. */
function sumToNumber(sum: { amount: unknown } | null): number {
  if (!sum?.amount) return 0;
  const v = sum.amount as { toNumber?: () => number };
  return typeof v.toNumber === 'function' ? v.toNumber() : Number(sum.amount);
}

/**
 * Lightweight financial engine — current-month window, no complex pipelines.
 * Uses direct Prisma queries against the existing Transaction table.
 */
export class V1FinancialEngine {
  /** Current calendar month boundaries in UTC. */
  private getMonthRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async getCashflow(userId: string): Promise<CashflowResult> {
    const { start, end } = this.getMonthRange();
    const dateFilter = { gte: start, lte: end };

    const [incomeAgg, expenseAgg, categoryGroups] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', date: dateFilter },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', date: dateFilter },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: { userId, type: 'EXPENSE', date: dateFilter },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 3,
      }),
    ]);

    const totalIncome = sumToNumber(incomeAgg._sum);
    const totalExpenses = sumToNumber(expenseAgg._sum);
    const savingsRate = totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) / 100
      : 0;

    const topCategories = categoryGroups.map((g) => ({
      category: g.category,
      amount: sumToNumber(g._sum),
    }));

    return { totalIncome, totalExpenses, savingsRate, topCategories };
  }
}

export const v1FinancialEngine = new V1FinancialEngine();
