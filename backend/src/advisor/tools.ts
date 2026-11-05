import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import prisma from '../config/database';
import { v1FinancialEngine } from '../services/v1FinancialEngine';
import { projectBudgets } from '../services/budgetProjectionService';
import { RAGService } from '../services/ragService';
import { goalProjection, simulateFinance } from '../services/financeSimulationService';
import { normalizeCategory } from '../domain/categoryRegistry';
import type {
  FinanceTools,
  ToolName,
  ToolData,
  Summary,
  SimulationInput,
  CategoryRow,
} from './types';
import { redact, simulationSchema } from './validation';

function category(value: string, type: 'expense' | 'income' = 'expense') {
  if (type === 'expense' && /^subscriptions?(?:[- ]memberships)?$/i.test(value))
    return 'subscriptions';
  return normalizeCategory(value, type)?.key || 'other';
}
function range(asOf: Date, offset = 0) {
  const start = DateTime.fromJSDate(asOf, { zone: 'utc' })
    .startOf('month')
    .plus({ months: offset });
  return {
    start: start.toJSDate(),
    end: start.plus({ months: 1 }).minus({ milliseconds: 1 }).toJSDate(),
  };
}
export class ScopedFinanceTools implements FinanceTools {
  constructor(
    private readonly userId: string,
    private readonly asOf = new Date()
  ) {
    if (!userId) throw new Error('UNAUTHORIZED');
  }
  async call<K extends ToolName>(
    name: K,
    input: { query?: string; simulation?: SimulationInput },
    signal: AbortSignal
  ): Promise<ToolData[K]> {
    signal.throwIfAborted();
    if (name === 'search_finance_knowledge') {
      if (!input.query || input.query.length > 1200) throw new Error('INVALID_INPUT');
      // Local keyword retrieval avoids hidden embedding calls and their unbounded costs.
      const chunks = await new RAGService().retrieveContext(redact(input.query), {
        keywordOnly: true,
        topK: 3,
        candidatePool: 100,
        similarityThreshold: 0.3,
      });
      signal.throwIfAborted();
      return chunks.map(c => ({
        id: c.id,
        excerpt: redact(c.content),
        source: redact(c.source || 'FIN-AI knowledge'),
        ...(c.indexedAt ? { indexedAt: c.indexedAt } : {}),
        educational: true as const,
      })) as ToolData[K];
    }
    return prisma.$transaction(
      async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
        const currentRange = () => ({ ...range(this.asOf), end: this.asOf });
        const summary = async (r = currentRange()): Promise<Summary> => {
          const flow = await v1FinancialEngine.getCashflow(this.userId, r, tx);
          const transactionCount = await tx.transaction.count({
            where: { userId: this.userId, date: { gte: r.start, lte: r.end } },
          });
          return {
            ...flow,
            topCategories: flow.topCategories.map(c => ({ ...c, category: category(c.category) })),
            netAmount: new Prisma.Decimal(flow.totalIncome).minus(flow.totalExpenses).toNumber(),
            transactionCount,
            start: r.start.toISOString(),
            end: r.end.toISOString(),
          };
        };
        const categories = async (r = currentRange()): Promise<CategoryRow[]> => {
          const rows = await tx.transaction.groupBy({
            by: ['category'],
            where: { userId: this.userId, type: 'EXPENSE', date: { gte: r.start, lte: r.end } },
            _sum: { amount: true },
          });
          const sums = new Map<string, Prisma.Decimal>();
          for (const row of rows) {
            const key = category(row.category);
            sums.set(key, (sums.get(key) || new Prisma.Decimal(0)).plus(row._sum.amount || 0));
          }
          return [...sums]
            .map(([category, amount]) => ({ category, amount: amount.toNumber() }))
            .sort((a, b) => b.amount - a.amount);
        };
        const goals = async () => {
          const baseline = await summary(range(this.asOf, -1));
          const rows = await tx.goal.findMany({
            where: { userId: this.userId, status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              targetAmount: true,
              currentAmount: true,
              targetDate: true,
            },
            orderBy: [{ targetDate: 'asc' }, { id: 'asc' }],
            take: 21,
          });
          if (rows.length > 20) throw new Error('UNAVAILABLE');
          return rows.map(row =>
            goalProjection(
              { ...row, name: redact(row.name).slice(0, 80) },
              baseline.transactionCount >= 3 && baseline.totalIncome > 0 ? baseline.netAmount : NaN,
              this.asOf
            )
          );
        };
        let result: ToolData[ToolName];
        switch (name) {
          case 'get_financial_summary':
            result = await summary();
            break;
          case 'get_budget_status': {
            const budgets = await tx.budget.findMany({
              where: { userId: this.userId, isActive: true },
              take: 101,
            });
            if (budgets.length > 100) throw new Error('UNAVAILABLE');
            result = (
              await projectBudgets(this.userId, budgets, { asOf: this.asOf, client: tx })
            ).map(b => ({
              id: b.id,
              category: category(b.categoryKey || 'other'),
              amount: Number(b.amount),
              spent: Number(b.spent),
              remaining: Number(b.remaining),
              status: b.categoryKey ? b.status : 'UNMAPPED',
              periodStart: b.periodStart.toISOString(),
              periodEnd: b.periodEnd.toISOString(),
            }));
            break;
          }
          case 'get_goal_progress':
            result = await goals();
            break;
          case 'get_category_breakdown':
            result = await categories();
            break;
          case 'get_spending_trends': {
            const currentRange = range(this.asOf);
            currentRange.end = this.asOf;
            const previousStart = DateTime.fromJSDate(currentRange.start, { zone: 'utc' }).minus({
              months: 1,
            });
            const previousEnd = previousStart.plus({
              milliseconds: this.asOf.getTime() - currentRange.start.getTime(),
            });
            const previousRange = {
              start: previousStart.toJSDate(),
              end: new Date(Math.min(previousEnd.toMillis(), currentRange.start.getTime() - 1)),
            };
            const current = await summary(currentRange),
              previous = await summary(previousRange);
            result = {
              current,
              previous,
              expenseChange: new Prisma.Decimal(current.totalExpenses)
                .minus(previous.totalExpenses)
                .toNumber(),
              comparable: current.transactionCount >= 3 && previous.transactionCount >= 3,
            };
            break;
          }
          case 'get_recurring_expenses': {
            const recent = await categories(range(this.asOf, -1));
            const earlier = await categories(range(this.asOf, -2));
            const candidates = recent.filter(
              c =>
                earlier.some(e => e.category === c.category && e.amount > 0) &&
                [
                  'subscriptions',
                  'house-rent-maintenance',
                  'utilities',
                  'mobile-internet-bills',
                ].includes(c.category)
            );
            result = {
              candidates,
              total: candidates
                .reduce((sum, c) => sum.plus(c.amount), new Prisma.Decimal(0))
                .toNumber(),
              inferred: true,
            };
            break;
          }
          case 'get_recent_transactions':
            result = (
              await tx.transaction.findMany({
                where: { userId: this.userId, date: { lte: this.asOf } },
                select: { amount: true, category: true, type: true, date: true },
                orderBy: { date: 'desc' },
                take: 10,
              })
            ).map(t => ({
              amount: Number(t.amount),
              category: category(t.category, t.type === 'INCOME' ? 'income' : 'expense'),
              type: t.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
              date: t.date.toISOString(),
            }));
            break;
          case 'simulate_savings_plan':
          case 'simulate_goal_change': {
            if (simulationSchema.validate(input.simulation, { convert: false }).error)
              throw new Error('INVALID_INPUT');
            const simulation = input.simulation!;
            if (simulation.category && category(simulation.category) !== simulation.category)
              throw new Error('INVALID_INPUT');
            const baseline = await summary(range(this.asOf, -1));
            if (!baseline.totalIncome || baseline.transactionCount < 3)
              throw new Error('INSUFFICIENT_DATA');
            const ownGoals = await goals();
            const goal = simulation.goalId
              ? ownGoals.find(g => g.id === simulation.goalId)
              : ownGoals.find(g => g.remaining > 0);
            if (!goal) throw new Error('NOT_FOUND');
            result = simulateFinance(
              simulation,
              baseline,
              await categories(range(this.asOf, -1)),
              goal,
              this.asOf
            );
            break;
          }
          default:
            throw new Error('INVALID_INPUT');
        }
        signal.throwIfAborted();
        if (Buffer.byteLength(JSON.stringify(result)) > 24000) throw new Error('UNAVAILABLE');
        return result as ToolData[K];
      },
      {
        timeout: 3000,
        maxWait: 1000,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }
    );
  }
}
