import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import type { GoalRow, Simulation, SimulationInput, Summary, CategoryRow } from '../advisor/types';

const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2).toNumber();
const decimal = (value: number) => new Prisma.Decimal(value);
export function goalProjection(
  goal: {
    id: string;
    name?: string;
    targetAmount: Prisma.Decimal | string | number;
    currentAmount: Prisma.Decimal | string | number;
    targetDate: Date | null;
  },
  surplus: number,
  asOf: Date
): GoalRow {
  const target = new Prisma.Decimal(goal.targetAmount);
  const current = new Prisma.Decimal(goal.currentAmount);
  const remaining = Prisma.Decimal.max(0, target.minus(current));
  const months = goal.targetDate
    ? Math.max(
        0,
        Math.floor(
          DateTime.fromJSDate(goal.targetDate, { zone: 'utc' }).diff(
            DateTime.fromJSDate(asOf, { zone: 'utc' }),
            'months'
          ).months
        )
      )
    : null;
  const required =
    months === null
      ? null
      : months > 0
        ? remaining.div(months).toDecimalPlaces(2, Prisma.Decimal.ROUND_CEIL).toNumber()
        : remaining.isZero()
          ? 0
          : null;
  return {
    id: goal.id,
    name: goal.name || 'Goal',
    target: money(target),
    current: money(current),
    remaining: money(remaining),
    targetDate: goal.targetDate?.toISOString() || null,
    monthlyRequired: required,
    monthsRemaining: months,
    status: remaining.isZero()
      ? 'complete'
      : months === 0
        ? 'behind'
        : required === null || !Number.isFinite(surplus)
          ? 'unknown'
          : surplus >= required
            ? 'ahead'
            : 'behind',
  };
}

export function simulateFinance(
  input: SimulationInput,
  baseline: Summary,
  categories: CategoryRow[],
  goal: GoalRow,
  asOf: Date
): Simulation {
  const savings = decimal(baseline.netAmount);
  let change = decimal(0);
  let remaining = decimal(goal.remaining);
  if (input.kind === 'increase_savings') change = decimal(input.amount!);
  if (input.kind === 'increase_sip') change = decimal(input.amount!).negated();
  if (input.kind === 'emergency_expense') remaining = remaining.plus(input.amount!);
  if (input.kind === 'reduce_category') {
    const category = categories.find(row => row.category === input.category);
    if (!category) throw new Error('INSUFFICIENT_DATA');
    change = decimal(category.amount).times(input.percent!).div(100);
  }
  change = change.toDecimalPlaces(2);
  const projected = savings.plus(change);
  const monthsFor = (rate: Prisma.Decimal, amount: Prisma.Decimal) =>
    amount.isZero() ? 0 : rate.isPositive() ? amount.div(rate).ceil().toNumber() : null;
  const before = monthsFor(savings, decimal(goal.remaining));
  const after = monthsFor(projected, remaining);
  const completion = (months: number | null) =>
    months === null || months > 1200
      ? null
      : DateTime.fromJSDate(asOf, { zone: 'utc' }).plus({ months }).toISODate();
  if (input.kind === 'change_deadline' && !goal.targetDate) throw new Error('INSUFFICIENT_DATA');
  const deadline =
    input.kind === 'change_deadline'
      ? goalProjection(
          {
            id: goal.id,
            targetAmount: goal.target,
            currentAmount: goal.current,
            targetDate: DateTime.fromISO(goal.targetDate!, { zone: 'utc' })
              .plus({ months: input.deadlineMonths! })
              .toJSDate(),
          },
          baseline.netAmount,
          asOf
        ).monthsRemaining
      : goal.monthsRemaining;
  if (input.kind === 'change_deadline' && deadline !== null && deadline <= 0)
    throw new Error('INVALID_INPUT');
  const required =
    deadline === null || deadline === 0
      ? null
      : remaining.div(deadline).toDecimalPlaces(2, Prisma.Decimal.ROUND_CEIL).toNumber();
  return {
    kind: input.kind,
    goalId: goal.id,
    baselineMonthlySavings: money(savings),
    monthlyChange: money(change),
    scenarioMonthlySavings: money(projected),
    remaining: money(remaining),
    baselineMonths: before,
    scenarioMonths: after,
    monthsEarlier: before === null || after === null ? null : before - after,
    baselineCompletion: completion(before),
    scenarioCompletion: completion(after),
    requiredMonthlySavings: required,
    affordable: projected.greaterThanOrEqualTo(0),
    basis: `${baseline.start}/${baseline.end}`,
  };
}
