import { ParsedIntent, ChatIntentType, TransactionEntities, QueryEntities } from '../../types';

interface RegexPattern {
  regex: RegExp;
  intent: ChatIntentType;
  extract: (match: RegExpMatchArray) => TransactionEntities;
}

export class RegexFallbackParser {
  private patterns: RegexPattern[] = [
    // "60000 salary received" / "50000 income" — amount then space then income phrase (before generic amount+desc)
    {
      regex: /^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?)\s+((?:salary|salay|sallary|income|received|freelance|gift|bonus|stipend|earned|credited|pay|interest|dividend|refund|cashback|reimbursement|capital gain|investment return)(?:\s+\S+)*)$/i,
      intent: ChatIntentType.LOG_INCOME,
      extract: (match) => ({
        amount: this.parseAmount(match[1]),
        description: this.normalizeDescription(match[2], 'income'),
        category: null,
        type: 'income',
        date: null,
      }),
    },
    // "spent 400 on burger" / "I spent ₹400 on burger" / "paid Rs.400 for cab"
    {
      regex: /(?:spent|paid|bought)\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:on|for|at)\s+(.+)/i,
      intent: ChatIntentType.LOG_EXPENSE,
      extract: (match) => ({
        amount: this.parseAmount(match[1]),
        description: match[2].trim(),
        category: null,
        type: 'expense',
        date: null,
      }),
    },
    // "400 on burger" / "₹400 for dinner"
    {
      regex: /^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:on|for|at)\s+(.+)/i,
      intent: ChatIntentType.LOG_EXPENSE,
      extract: (match) => ({
        amount: this.parseAmount(match[1]),
        description: match[2].trim(),
        category: null,
        type: 'expense',
        date: null,
      }),
    },
    // "got 50000 salary" / "received ₹50000 from client"
    {
      regex: /(?:got|received|earned|credited)\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?)\s+(?:from|as|for)?\s*(.+)/i,
      intent: ChatIntentType.LOG_INCOME,
      extract: (match) => ({
        amount: this.parseAmount(match[1]),
        description: this.normalizeDescription(match[2], 'income'),
        category: null,
        type: 'income',
        date: null,
      }),
    },
    // "salary 50000" / "income ₹50000" / "dividend 500" / "interest 100"
    {
      regex: /((?:salary|salay|sallary|income|credited|freelance|bonus|stipend|interest|dividend|refund|cashback|reimbursement|capital gain|investment return))(?:\s+\S+)*\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?)/i,
      intent: ChatIntentType.LOG_INCOME,
      extract: (match) => ({
        amount: this.parseAmount(match[2]),
        description: this.normalizeDescription(match[1], 'income'),
        category: null,
        type: 'income',
        date: null,
      }),
    },
    // "50 dosa" / "40 idli" / "100 masala dosa" — amount then space then description (no "on/for/at")
    {
      regex: /^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?)\s+(\S+(?:\s+\S+)*)$/,
      intent: ChatIntentType.LOG_EXPENSE,
      extract: (match) => {
        const desc = match[2].trim();
        const queryWords = /\b(this|last|month|week|year|much|many|today|spent|income|salary|salay|sallary|budget)\b/i;
        const looksLikeQuery = queryWords.test(desc) || desc.length < 2 || /^\d+$/.test(desc);
        if (looksLikeQuery) {
          return { amount: 0, description: '', category: null, type: 'expense', date: null };
        }
        return {
          amount: this.parseAmount(match[1]),
          description: this.normalizeDescription(desc, 'expense'),
          category: null,
          type: 'expense',
          date: null,
        };
      },
    },
  ];

  parse(message: string): ParsedIntent | null {
    if (message == null || typeof message !== 'string') return null;
    const trimmed = message.trim().replace(/\s+/g, ' ');
    if (!trimmed) return null;

    const queryIntent = this.parseQueryIntent(trimmed);
    if (queryIntent) return queryIntent;

    const budgetIntent = this.parseBudgetQueryIntent(trimmed);
    if (budgetIntent) return budgetIntent;

    for (const pattern of this.patterns) {
      const match = trimmed.match(pattern.regex);
      if (match) {
        const entities = pattern.extract(match);
        if (entities.amount > 0) {
          return {
            intent: pattern.intent,
            confidence: 0.6,
            entities,
            isFallback: true,
          };
        }
      }
    }
    return null;
  }

  private parseBudgetQueryIntent(message: string): ParsedIntent | null {
    const text = message.toLowerCase();
    const budgetQueryPattern =
      /\b(check|show|view|see|status|summary)\b.*\bbudget(s)?\b|\bbudget(s)?\s+(status|summary)\b|^(my\s+)?budgets?$/i;

    if (!budgetQueryPattern.test(text)) {
      return null;
    }

    return {
      intent: ChatIntentType.QUERY_BUDGET,
      confidence: 0.65,
      entities: null,
      isFallback: true,
    };
  }

  private parseQueryIntent(message: string): ParsedIntent | null {
    const text = message.toLowerCase();

    const hasQueryVerb = /\b(how much|total|summary|report|show|tell me|what is|what did)\b/i.test(text);
    const hasFinanceSignal = /\b(spend|spent|expense|expenses|income|earned|earn|received)\b/i.test(text);
    const isTimeOnly = /^(today|yesterday|this week|last week|this month|last month|this year)$/i.test(text);
    const isMonthlySummary =
      /\b(monthly summary|month summary|monthly spending|spent this month|this month summary|month(ly)? report|monthly stats)\b/i.test(text);

    if (!((hasQueryVerb && hasFinanceSignal) || isTimeOnly || isMonthlySummary)) {
      return null;
    }

    const type: QueryEntities['type'] =
      /\b(income|earned|earn|received)\b/i.test(text) &&
      !/\b(spend|spent|expense|expenses)\b/i.test(text)
        ? 'income'
        : 'expense';

    const entities: QueryEntities = {
      category: this.extractCategoryFromQuery(text),
      timeRange: this.extractTimeRange(text),
      startDate: null,
      endDate: null,
      type,
    };

    return {
      intent: type === 'income' ? ChatIntentType.QUERY_INCOME : ChatIntentType.QUERY_SPENDING,
      confidence: 0.65,
      entities,
      isFallback: true,
    };
  }

  private parseAmount(raw: string): number {
    const cleaned = raw.replace(/,/g, '');
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
  }

  private normalizeDescription(raw: string, type: 'income' | 'expense'): string {
    const normalized = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    if (type === 'income') {
      if (/\b(salay|sallary|salary)\b/i.test(normalized)) return 'salary';
      if (/\b(paycheck|pay day|pay)\b/i.test(normalized)) return 'salary';
      if (/\b(dividend|capital gain|investment return)\b/i.test(normalized)) return 'investment return';
      if (/\b(cashback|refund|reimbursement)\b/i.test(normalized)) return 'refund';
    }
    return normalized;
  }

  private extractTimeRange(text: string): QueryEntities['timeRange'] {
    if (/\byesterday\b/i.test(text)) return 'yesterday';
    if (/\btoday\b/i.test(text)) return 'today';
    if (/\blast week\b/i.test(text)) return 'last_week';
    if (/\bthis week\b/i.test(text)) return 'this_week';
    if (/\blast month\b/i.test(text)) return 'last_month';
    if (/\bthis year\b/i.test(text)) return 'this_year';
    return 'this_month';
  }

  private extractCategoryFromQuery(text: string): string | null {
    const categoryMatch = text.match(/\b(?:on|for|in)\s+([a-z][a-z &'/-]{2,30})\b/i);
    if (!categoryMatch) return null;

    const cleaned = categoryMatch[1]
      .replace(/\b(today|yesterday|this week|last week|this month|last month|this year)\b/gi, '')
      .trim();

    if (!cleaned) return null;

    return cleaned
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
