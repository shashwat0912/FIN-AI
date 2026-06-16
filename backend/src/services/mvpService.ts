import prisma from '../config/database';

/** Calendar week Monday 00:00 UTC → Sunday 23:59:59.999 UTC (MVP simplicity). */
function getUtcWeekRangeContaining(date: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - daysSinceMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function getPreviousUtcWeekRange(weekStart: Date): { weekStart: Date; weekEnd: Date } {
  const prevMonday = new Date(weekStart);
  prevMonday.setUTCDate(weekStart.getUTCDate() - 7);
  prevMonday.setUTCHours(0, 0, 0, 0);
  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
  prevSunday.setUTCHours(23, 59, 59, 999);
  return { weekStart: prevMonday, weekEnd: prevSunday };
}

function decimalSumToNumber(sum: { amount: unknown } | null): number {
  if (!sum?.amount) return 0;
  const v = sum.amount as { toNumber?: () => number };
  return typeof v.toNumber === 'function' ? v.toNumber() : Number(sum.amount);
}

export type MvpCoachAction = {
  type: 'set_budget';
  label: string;
  payload: { category: string; suggestedLimit: number };
};

export type MvpCoachResult = {
  message: string;
  action?: MvpCoachAction;
};

export class MVPService {
  parseExpense(message: string): { amount: number; description: string } | null {
    const trimmed = message.trim();
    if (!trimmed) return null;

    const spentOn = /spent\s+(\d+(?:\.\d+)?)\s+on\s+(.+)/i.exec(trimmed);
    if (spentOn) {
      return { amount: parseFloat(spentOn[1]), description: spentOn[2].trim() };
    }

    const onFor = /(\d+(?:\.\d+)?)\s+(?:on|for)\s+(.+)/i.exec(trimmed);
    if (onFor) {
      return { amount: parseFloat(onFor[1]), description: onFor[2].trim() };
    }

    const fallback = /^.*?(\d+(?:\.\d+)?)\s+(.+)$/i.exec(trimmed);
    if (fallback && fallback[2].trim().length > 0) {
      return { amount: parseFloat(fallback[1]), description: fallback[2].trim() };
    }

    return null;
  }

  inferCategory(description: string): 'food' | 'transport' | 'entertainment' | 'others' {
    const lower = description.toLowerCase();

    const food = /\b(burger|food|meal|lunch|dinner|breakfast|coffee|restaurant|pizza|grocer|snack|chai|biryani)\b/;
    const transport = /\b(taxi|uber|metro|bus|train|fuel|petrol|diesel|parking|auto|rickshaw|cab)\b/;
    const entertainment = /\b(movie|cinema|show|concert|game|netflix|spotify|party|club)\b/;

    if (food.test(lower)) return 'food';
    if (transport.test(lower)) return 'transport';
    if (entertainment.test(lower)) return 'entertainment';
    return 'others';
  }

  async getWeeklySpend(userId: string, category: string): Promise<number> {
    const now = new Date();
    const { weekStart, weekEnd } = getUtcWeekRangeContaining(now);
    const result = await prisma.transaction.aggregate({
      where: {
        userId,
        category,
        type: 'EXPENSE',
        date: { gte: weekStart, lte: weekEnd },
      },
      _sum: { amount: true },
    });
    return decimalSumToNumber(result._sum);
  }

  async getPreviousWeekSpend(userId: string, category: string): Promise<number> {
    const now = new Date();
    const { weekStart } = getUtcWeekRangeContaining(now);
    const { weekStart: prevStart, weekEnd: prevEnd } = getPreviousUtcWeekRange(weekStart);
    const result = await prisma.transaction.aggregate({
      where: {
        userId,
        category,
        type: 'EXPENSE',
        date: { gte: prevStart, lte: prevEnd },
      },
      _sum: { amount: true },
    });
    return decimalSumToNumber(result._sum);
  }

  async handleMessage(userId: string, message: string): Promise<MvpCoachResult> {
    const parsed = this.parseExpense(message);
    if (!parsed) {
      return {
        message:
          'Could not read an expense. Try something like: spent 400 on burger',
      };
    }

    const category = this.inferCategory(parsed.description);

    await prisma.transaction.create({
      data: {
        userId,
        amount: parsed.amount,
        description: parsed.description,
        category,
        type: 'EXPENSE',
        source: 'mvp',
        date: new Date(),
      },
    });

    const currentWeekSpend = await this.getWeeklySpend(userId, category);
    const previousWeekSpend = await this.getPreviousWeekSpend(userId, category);

    let text = `Logged ${parsed.amount} for “${parsed.description}” under ${category}. This week’s total for ${category}: ${currentWeekSpend}.`;

    if (previousWeekSpend > 0 && currentWeekSpend > previousWeekSpend * 1.3) {
      text += ` That is more than 30% above last week’s ${category} spend (${previousWeekSpend}).`;
      const suggestedLimit = Math.ceil(previousWeekSpend * 1.1);
      return {
        message: text,
        action: {
          type: 'set_budget',
          label: `Set a weekly cap for ${category}`,
          payload: { category, suggestedLimit },
        },
      };
    }

    return { message: text };
  }
}

export const mvpService = new MVPService();
