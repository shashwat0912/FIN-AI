import OpenAI from 'openai';
import { config } from '../../config/env';
import { hasUsableOpenAiKey } from '../../config/openai';
import { buildContext, V1Context } from './v1ContextBuilder';
import logger from '../../config/logger';

function formatContext(ctx: V1Context): string {
  const cats = ctx.topCategories
    .map((c) => `  - ${c.category}: ${c.amount}`)
    .join('\n');
  return [
    `Total income (this month): ${ctx.totalIncome}`,
    `Total expenses (this month): ${ctx.totalExpenses}`,
    `Savings rate: ${(ctx.savingsRate * 100).toFixed(0)}%`,
    `Top expense categories:\n${cats || '  (none)'}`,
  ].join('\n');
}

const SYSTEM_PROMPT = `You are a personal finance assistant.
Use ONLY the provided data. Do not make up numbers.
Be concise and specific.`;

function buildUserPrompt(context: string, query: string): string {
  return `Context:\n${context}\n\nUser question:\n${query}\n\nRespond in this format:\n1. What is happening\n2. Why it matters\n3. What to do`;
}

/**
 * Generate a single AI insight from the user's financial context.
 * Falls back to a deterministic summary when no usable OpenAI key is configured.
 */
export async function getInsight(userId: string, query: string): Promise<string> {
  const ctx = await buildContext(userId);
  const contextText = formatContext(ctx);

  if (!hasUsableOpenAiKey()) {
    logger.info('V1 insight: no usable OpenAI key, returning deterministic summary');
    return deterministicFallback(ctx, query);
  }

  try {
    const openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: config.OPENAI_TIMEOUT_MS,
    });

    const completion = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      max_tokens: config.OPENAI_MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(contextText, query) },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() ?? deterministicFallback(ctx, query);
  } catch (err) {
    logger.error('V1 insight OpenAI call failed, using fallback', err);
    return deterministicFallback(ctx, query);
  }
}

function deterministicFallback(ctx: V1Context, _query: string): string {
  const top = ctx.topCategories[0];
  const lines = [
    `1. What is happening: You earned ${ctx.totalIncome} and spent ${ctx.totalExpenses} this month.`,
    `2. Why it matters: Your savings rate is ${(ctx.savingsRate * 100).toFixed(0)}%.${
      top ? ` Your biggest expense category is ${top.category} at ${top.amount}.` : ''
    }`,
    `3. What to do: ${
      ctx.savingsRate < 0.1
        ? 'Try to cut discretionary spending to improve your savings rate.'
        : 'Keep it up — your savings rate looks healthy.'
    }`,
  ];
  return lines.join('\n');
}
