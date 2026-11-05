import Joi from 'joi';
import { CATEGORY_REGISTRY } from '../domain/categoryRegistry';
import type { ToolName, ToolData } from './types';
const number = Joi.number().max(1e15).min(-1e15).required();
const nonnegative = Joi.number().min(0).max(1e15).required();
const text = Joi.string().max(1600).required();
const date = Joi.string().isoDate().required();
const categoryName = Joi.string()
  .valid(...CATEGORY_REGISTRY.map(c => c.key), 'subscriptions', 'other')
  .required();
const category = Joi.object({ category: categoryName, amount: nonnegative });
const summary = Joi.object({
  totalIncome: nonnegative,
  totalExpenses: nonnegative,
  savingsRate: number,
  netAmount: number,
  transactionCount: Joi.number().integer().min(0).required(),
  start: date,
  end: date,
  topCategories: Joi.array().items(category).max(3).required(),
});
const simulation = Joi.object({
  kind: Joi.string()
    .valid(
      'increase_savings',
      'reduce_category',
      'increase_sip',
      'emergency_expense',
      'change_deadline'
    )
    .required(),
  goalId: text,
  baselineMonthlySavings: number,
  monthlyChange: number,
  scenarioMonthlySavings: number,
  remaining: nonnegative,
  baselineMonths: nonnegative.allow(null),
  scenarioMonths: nonnegative.allow(null),
  monthsEarlier: number.allow(null),
  baselineCompletion: date.allow(null),
  scenarioCompletion: date.allow(null),
  requiredMonthlySavings: nonnegative.allow(null),
  affordable: Joi.boolean().required(),
  basis: text,
});
const schemas: Record<ToolName, Joi.Schema> = {
  get_financial_summary: summary,
  get_budget_status: Joi.array()
    .max(100)
    .items(
      Joi.object({
        id: text,
        category: categoryName,
        amount: nonnegative,
        spent: nonnegative,
        remaining: number,
        status: Joi.string()
          .valid('ON_TRACK', 'NEAR_LIMIT', 'OVER_BUDGET', 'INACTIVE', 'UNMAPPED')
          .required(),
        periodStart: date,
        periodEnd: date,
      })
    ),
  get_goal_progress: Joi.array()
    .max(20)
    .items(
      Joi.object({
        id: text,
        name: Joi.string().max(80).required(),
        target: nonnegative,
        current: nonnegative,
        remaining: nonnegative,
        targetDate: date.allow(null),
        monthlyRequired: nonnegative.allow(null),
        monthsRemaining: nonnegative.allow(null),
        status: Joi.string().valid('ahead', 'behind', 'unknown', 'complete').required(),
      })
    ),
  get_category_breakdown: Joi.array().max(100).items(category),
  get_spending_trends: Joi.object({
    current: summary,
    previous: summary,
    expenseChange: number,
    comparable: Joi.boolean().required(),
  }),
  get_recurring_expenses: Joi.object({
    candidates: Joi.array().max(100).items(category),
    total: nonnegative,
    inferred: Joi.valid(true).required(),
  }),
  get_recent_transactions: Joi.array()
    .max(10)
    .items(
      Joi.object({
        amount: nonnegative,
        category: categoryName,
        type: Joi.string().valid('INCOME', 'EXPENSE').required(),
        date,
      })
    ),
  simulate_savings_plan: simulation,
  simulate_goal_change: simulation,
  search_finance_knowledge: Joi.array()
    .max(3)
    .items(
      Joi.object({ id: text, excerpt: text, source: text, educational: Joi.valid(true).required() })
    ),
};
export function validateOutput<K extends ToolName>(name: K, raw: unknown): ToolData[K] {
  if (
    JSON.stringify(raw)?.length > 24000 ||
    schemas[name].required().validate(raw, { convert: false }).error
  )
    throw new Error('UNAVAILABLE');
  return raw as ToolData[K];
}
