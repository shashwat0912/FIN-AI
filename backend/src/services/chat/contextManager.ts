import prisma from '../../config/database';
import logger from '../../config/logger';
import { OpenAIMessage } from '../../types';

const SYSTEM_PROMPT = `You are a smart financial assistant for an Indian personal finance app called Finance AI.

Your capabilities:
- Log expenses and income from natural language ("spent 400 on burger", "got 50000 salary")
- Answer spending and income queries ("how much did I spend on food this month?")
- Create and manage budgets ("set food budget to 5000")
- Provide personalized financial advice for the Indian market

Rules:
- Always use INR (₹) as currency
- When logging transactions, extract: amount, description, category, type (income/expense), and optional date
- If category is ambiguous, ASK the user to pick one
- For date references like "today", "yesterday", "this month", resolve relative to the user's timezone
- Keep responses concise and actionable
- Use the available tools/functions to handle structured operations`;

interface ContextConfig {
  maxTotalTokens: number;
  slidingWindowSize: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTotalTokens: 4000,
  slidingWindowSize: 10,
};

export class ContextManager {
  private config: ContextConfig;

  constructor(config?: Partial<ContextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async buildContextWindow(userId: string, newMessage: string): Promise<OpenAIMessage[]> {
    const messages: OpenAIMessage[] = [];

    messages.push({ role: 'system', content: SYSTEM_PROMPT });

    try {
      const financialCtx = await this.buildFinancialContext(userId);
      if (financialCtx) {
        messages.push({ role: 'system', content: financialCtx });
      }
    } catch (err) {
      logger.error('Failed to build financial context', err);
    }

    try {
      const summary = await prisma.conversationSummary.findUnique({ where: { userId } });
      if (summary) {
        messages.push({ role: 'system', content: `Previous conversation context: ${summary.summary}` });
      }
    } catch (err) {
      logger.error('Failed to load conversation summary', err);
    }

    try {
      const recentMsgs = await this.getRecentMessages(userId, this.config.slidingWindowSize);
      messages.push(...recentMsgs);
    } catch (err) {
      logger.error('Failed to load recent messages', err);
    }

    messages.push({ role: 'user', content: newMessage });

    return this.trimToFit(messages, this.config.maxTotalTokens);
  }

  private async buildFinancialContext(userId: string): Promise<string | null> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [transactions, budgets, goals, user] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      prisma.budget.findMany({ where: { userId, isActive: true } }),
      prisma.goal.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    ]);

    const monthlyIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const categorySpend: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'EXPENSE')
      .forEach((t) => {
        categorySpend[t.category] = (categorySpend[t.category] || 0) + Number(t.amount);
      });

    const topCategories = Object.entries(categorySpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `${cat}: ₹${amt.toLocaleString('en-IN')}`)
      .join(', ');

    const budgetInfo = budgets
      .map((b) => `${b.name}: ₹${Number(b.spent).toLocaleString('en-IN')} / ₹${Number(b.amount).toLocaleString('en-IN')}`)
      .join(', ');

    const goalInfo = goals
      .map((g) => `${g.name}: ₹${Number(g.currentAmount).toLocaleString('en-IN')} / ₹${Number(g.targetAmount).toLocaleString('en-IN')}`)
      .join(', ');

    const lines = [
      `User timezone: ${user?.timezone || 'Asia/Kolkata'}`,
      `Monthly income (last 30d): ₹${monthlyIncome.toLocaleString('en-IN')}`,
      `Monthly expenses (last 30d): ₹${monthlyExpense.toLocaleString('en-IN')}`,
    ];
    if (topCategories) lines.push(`Top spending: ${topCategories}`);
    if (budgetInfo) lines.push(`Active budgets: ${budgetInfo}`);
    if (goalInfo) lines.push(`Active goals: ${goalInfo}`);

    const allCategories = [...new Set(transactions.map((t) => t.category))];
    if (allCategories.length > 0) {
      lines.push(`User's categories: ${allCategories.join(', ')}`);
    }

    return `User Financial Context:\n${lines.join('\n')}`;
  }

  private async getRecentMessages(userId: string, count: number): Promise<OpenAIMessage[]> {
    const msgs = await prisma.chatMessage.findMany({
      where: { userId, role: { not: 'SYSTEM' } },
      orderBy: { createdAt: 'desc' },
      take: count,
      select: { role: true, content: true },
    });

    return msgs.reverse().map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant',
      content: m.content,
    }));
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.split(/\s+/).length / 0.75);
  }

  private trimToFit(messages: OpenAIMessage[], maxTokens: number): OpenAIMessage[] {
    let totalTokens = messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);

    while (totalTokens > maxTokens && messages.length > 3) {
      // Remove the oldest non-system message (index 1 is likely first system context)
      const removeIdx = messages.findIndex((m, i) => i > 0 && m.role !== 'system');
      if (removeIdx === -1) break;
      totalTokens -= this.estimateTokens(messages[removeIdx].content);
      messages.splice(removeIdx, 1);
    }

    return messages;
  }
}
