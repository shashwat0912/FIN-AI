import prisma from '../config/database';
import { generateInsights, Insight } from '../services/insightEngine';

type ParsedExpense = {
  amount: number;
  description: string;
};

type SavedTransaction = {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: string;
  date: Date;
};

export type MvpChatResult = {
  message: string;
  transaction: SavedTransaction;
  insights: Insight[];
};

const EXPENSE_PATTERNS = [
  /spent\s+(?:rs\.?\s*|inr\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\s+(?:on|for|at)\s+(.+)/i,
  /(?:rs\.?\s*|inr\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\s+(?:on|for|at)\s+(.+)/i,
  /spent\s+(?:rs\.?\s*|inr\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\s+(.+)/i,
  /(?:rs\.?\s*|inr\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\s+(.+)/i,
];

export class MvpService {
  parseMessage(message: string): ParsedExpense | null {
    const normalized = message.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return null;
    }

    for (const pattern of EXPENSE_PATTERNS) {
      const match = normalized.match(pattern);
      if (!match) {
        continue;
      }

      const amount = Number.parseFloat(match[1]);
      const description = match[2].trim();

      if (Number.isFinite(amount) && amount > 0 && description.length > 0) {
        return { amount, description };
      }
    }

    return null;
  }

  inferCategory(description: string): string {
    const normalized = description.toLowerCase();

    if (/\b(burger|swiggy|zomato|pizza|coffee|meal|food|lunch|dinner|breakfast)\b/.test(normalized)) {
      return 'Food';
    }

    if (/\b(uber|ola|cab|taxi|metro|bus|train|fuel|petrol|auto)\b/.test(normalized)) {
      return 'Transport';
    }

    return 'Others';
  }

  async handleMessage(userId: string, message: string): Promise<MvpChatResult> {
    const parsed = this.parseMessage(message);

    if (!parsed) {
      const error = new Error('Could not parse the message. Try "Spent 400 on burger".') as Error & {
        statusCode?: number;
      };
      error.statusCode = 400;
      throw error;
    }

    const category = this.inferCategory(parsed.description);
    const createdTransaction = await prisma.transaction.create({
      data: {
        userId,
        amount: parsed.amount,
        description: parsed.description,
        category,
        type: 'EXPENSE',
        source: 'mvp',
        date: new Date(),
      },
      select: {
        id: true,
        amount: true,
        description: true,
        category: true,
        type: true,
        date: true,
      },
    });

    const insights = await generateInsights(userId);

    return {
      message: `₹${parsed.amount.toLocaleString('en-IN')} added to ${category}`,
      transaction: {
        id: createdTransaction.id,
        amount: Number(createdTransaction.amount),
        description: createdTransaction.description,
        category: createdTransaction.category,
        type: createdTransaction.type,
        date: createdTransaction.date,
      },
      insights,
    };
  }
}

export const mvpService = new MvpService();
