import Joi from 'joi';
import { TOOL_NAMES, type AdvisorInput, type Plan } from './types';

export const simulationSchema = Joi.object({
  kind: Joi.string()
    .valid(
      'increase_savings',
      'reduce_category',
      'increase_sip',
      'emergency_expense',
      'change_deadline'
    )
    .required(),
  amount: Joi.number()
    .positive()
    .max(10000000)
    .precision(2)
    .when('kind', {
      is: Joi.valid('increase_savings', 'increase_sip', 'emergency_expense'),
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  percent: Joi.number()
    .positive()
    .max(100)
    .when('kind', { is: 'reduce_category', then: Joi.required(), otherwise: Joi.forbidden() }),
  category: Joi.string()
    .max(64)
    .when('kind', { is: 'reduce_category', then: Joi.required(), otherwise: Joi.forbidden() }),
  deadlineMonths: Joi.number()
    .integer()
    .min(-120)
    .max(120)
    .invalid(0)
    .when('kind', { is: 'change_deadline', then: Joi.required(), otherwise: Joi.forbidden() }),
  goalId: Joi.string().alphanum().max(40),
});
const inputSchema = Joi.object({
  question: Joi.string().trim().min(3).max(1200).required(),
  simulation: simulationSchema,
});
const planSchema = Joi.object({
  intent: Joi.string()
    .valid('overview', 'spending', 'budget', 'goal', 'simulation', 'knowledge', 'unsupported')
    .required(),
  tools: Joi.array()
    .items(Joi.string().valid(...TOOL_NAMES))
    .unique()
    .max(6)
    .required(),
  simulation: simulationSchema,
});
export function validateInput(raw: unknown): AdvisorInput {
  const result = inputSchema.validate(raw, { convert: false });
  if (result.error) throw new Error('INVALID_INPUT');
  return result.value as AdvisorInput;
}
export function validatePlan(raw: unknown): Plan {
  const result = planSchema.validate(raw, { convert: false });
  if (result.error) throw new Error('INVALID_PLAN');
  const plan = result.value as Plan;
  if (plan.intent === 'simulation' && !plan.simulation) throw new Error('INVALID_PLAN');
  if (plan.tools.some(t => t.startsWith('simulate_')) && plan.intent !== 'simulation')
    throw new Error('INVALID_PLAN');
  return plan;
}

export function redact(text: string): string {
  return text
    .replace(/\bBearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s]*:[^\s]*@[^\s]+/gi, '[redacted]')
    .replace(
      /\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9_]+|github_pat_[a-zA-Z0-9_]+|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g,
      '[redacted]'
    )
    .replace(
      /(?:pass(?:word|wd)?|secret|token|api[_-]?key)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/gi,
      '[redacted]'
    )
    .slice(0, 1600);
}
