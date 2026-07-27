import { Budget, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import prisma from '../config/database';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const ZERO = new Prisma.Decimal(0);
const ONE_HUNDRED = new Prisma.Decimal(100);

export type BudgetStatus = 'ON_TRACK' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'INACTIVE';

export type BudgetProjection = Budget & {
  spent: Prisma.Decimal;
  remaining: Prisma.Decimal;
  utilizationPercentage: Prisma.Decimal;
  status: BudgetStatus;
  periodStart: Date;
  periodEnd: Date;
  timezone: string;
};

function utilizationPercentage(spent: Prisma.Decimal, amount: Prisma.Decimal): Prisma.Decimal {
  if (amount.isZero()) return spent.isZero() ? ZERO : ONE_HUNDRED;
  return spent.dividedBy(amount).times(100).toDecimalPlaces(2);
}

export function getBudgetPeriodRange(
  period: string,
  timezone: string,
  asOf: Date = new Date()
): { start: Date; end: Date; timezone: string } {
  const zoned = DateTime.fromJSDate(asOf, { zone: timezone });
  const safeTimezone = zoned.isValid ? timezone : DEFAULT_TIMEZONE;
  const now = zoned.isValid ? zoned : DateTime.fromJSDate(asOf, { zone: DEFAULT_TIMEZONE });
  const unit = period === 'WEEKLY' ? 'week' : period === 'YEARLY' ? 'year' : 'month';
  const start = now.startOf(unit);
  const end = period === 'WEEKLY'
    ? start.plus({ weeks: 1 })
    : period === 'YEARLY'
      ? start.plus({ years: 1 })
      : start.plus({ months: 1 });

  // Calendar periods use the user's IANA timezone. The end is exclusive.
  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),
    timezone: safeTimezone,
  };
}

export async function projectBudgets(
  userId: string,
  budgets: Budget[],
  options: { timezone?: string; asOf?: Date } = {}
): Promise<BudgetProjection[]> {
  if (budgets.length === 0) return [];

  const timezone = options.timezone || (
    await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  )?.timezone || DEFAULT_TIMEZONE;
  const asOf = options.asOf || new Date();
  const ranges = new Map<string, ReturnType<typeof getBudgetPeriodRange>>();

  for (const budget of budgets) {
    if (!ranges.has(budget.period)) {
      ranges.set(budget.period, getBudgetPeriodRange(budget.period, timezone, asOf));
    }
  }

  const sums = new Map<string, Prisma.Decimal>();
  await Promise.all([...ranges].map(async ([period, range]) => {
    const categoryKeys = [...new Set(
      budgets
        .filter((budget) => budget.period === period && budget.categoryKey)
        .map((budget) => budget.categoryKey as string)
    )];
    if (categoryKeys.length === 0) return;

    const grouped = await prisma.transaction.groupBy({
      by: ['categoryKey'],
      where: {
        userId,
        type: 'EXPENSE',
        categoryKey: { in: categoryKeys },
        date: { gte: range.start, lt: range.end },
      },
      _sum: { amount: true },
    });

    for (const row of grouped) {
      if (row.categoryKey) sums.set(`${period}:${row.categoryKey}`, row._sum.amount || ZERO);
    }
  }));

  return budgets.map((budget) => {
    const range = ranges.get(budget.period)!;
    const spent = budget.categoryKey
      ? sums.get(`${budget.period}:${budget.categoryKey}`) || ZERO
      : ZERO;
    const remaining = budget.amount.minus(spent);
    const utilization = utilizationPercentage(spent, budget.amount);
    const status: BudgetStatus = !budget.isActive
      ? 'INACTIVE'
      : utilization.greaterThanOrEqualTo(100)
        ? 'OVER_BUDGET'
        : utilization.greaterThanOrEqualTo(80)
          ? 'NEAR_LIMIT'
          : 'ON_TRACK';

    return {
      ...budget,
      spent,
      remaining,
      utilizationPercentage: utilization,
      status,
      periodStart: range.start,
      periodEnd: range.end,
      timezone: range.timezone,
    };
  });
}

export function summarizeBudgetProjections(budgets: BudgetProjection[]) {
  const totalBudget = budgets.reduce((sum, budget) => sum.plus(budget.amount), ZERO);
  const totalSpent = budgets.reduce((sum, budget) => sum.plus(budget.spent), ZERO);
  return {
    totalBudget,
    totalSpent,
    remainingBudget: totalBudget.minus(totalSpent),
    utilizationPercentage: utilizationPercentage(totalSpent, totalBudget),
  };
}
