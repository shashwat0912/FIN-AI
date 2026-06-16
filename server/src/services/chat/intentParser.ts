import OpenAI from 'openai';
import { config } from '../../config/env';
import logger from '../../config/logger';
import { ParsedIntent, ChatIntentType, OpenAIMessage, QueryEntities } from '../../types';
import { RegexFallbackParser } from './regexFallbackParser';
import { hasUsableOpenAiKey } from '../../config/openai';

const TOOL_SCHEMAS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'log_transaction',
      description: 'Log a financial transaction (expense or income)',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Transaction amount in INR' },
          description: { type: 'string', description: 'Short description of the transaction' },
          category: { type: 'string', description: 'Category like Food, Transport, Shopping, Rent, Salary, Freelance, etc. Null if uncertain.', nullable: true },
          type: { type: 'string', enum: ['expense', 'income'] },
          date: { type: 'string', description: 'ISO date string if mentioned, null for today', nullable: true },
        },
        required: ['amount', 'description', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_spending',
      description: 'Query spending or income analytics',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', nullable: true },
          timeRange: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'] },
          type: { type: 'string', enum: ['income', 'expense', 'both'], default: 'expense' },
        },
        required: ['timeRange'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_budget',
      description: 'Create or update a budget for a category',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          amount: { type: 'number' },
          period: { type: 'string', enum: ['monthly', 'weekly'] },
        },
        required: ['category', 'amount', 'period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_advice',
      description: 'Get personalized financial advice',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The financial topic the user wants advice on' },
        },
        required: ['topic'],
      },
    },
  },
];

export class IntentParser {
  private openai: OpenAI | null = null;
  private regexFallback: RegexFallbackParser;

  constructor() {
    const aiProvider = (config.AI_PROVIDER || 'auto').toLowerCase();
    const openAiAllowed = aiProvider === 'openai' || aiProvider === 'auto';
    if (openAiAllowed && hasUsableOpenAiKey(config.OPENAI_API_KEY)) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
        timeout: config.OPENAI_TIMEOUT_MS,
      });
    }
    this.regexFallback = new RegexFallbackParser();
  }

  async parse(userMessage: string, contextMessages: OpenAIMessage[]): Promise<ParsedIntent> {
    const normalized = userMessage != null ? String(userMessage).trim().replace(/\s+/g, ' ') : '';
    const deterministicIntent = this.parseDeterministically(normalized);
    if (deterministicIntent) {
      return deterministicIntent;
    }

    // Always try regex first for "amount + description" (e.g. "50 dosa", "40 idli"). This ensures
    // short expense phrases work even when OpenAI is unset, fails, or doesn't call the tool.
    const regexResult = this.regexFallback.parse(normalized);
    if (regexResult) {
      return regexResult;
    }

    if (!this.openai) {
      logger.debug('OpenAI unavailable for intent parsing; using deterministic fallback');
      return this.buildUnclearResponse();
    }

    try {
      const openAiResult = await this.parseWithOpenAI(userMessage, contextMessages);
      const isGeneralOrUnclear =
        openAiResult.intent === ChatIntentType.GENERAL_CHAT ||
        openAiResult.intent === ChatIntentType.UNCLEAR;
      if (isGeneralOrUnclear) {
        const retryRegex = this.regexFallback.parse(normalized);
        if (retryRegex) return retryRegex;
      }
      return openAiResult;
    } catch (error: unknown) {
      const err = error as { status?: number; code?: string; message?: string };
      const isTransient =
        err?.status === 429 ||
        err?.status === 503 ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNRESET';

      if (isTransient) {
        logger.warn('OpenAI unavailable, falling back to regex parser', { error: err?.message });
        return this.buildUnclearResponse();
      }

      logger.error('OpenAI intent parsing error:', error);
      return this.buildUnclearResponse();
    }
  }

  private async parseWithOpenAI(userMessage: string, contextMessages: OpenAIMessage[]): Promise<ParsedIntent> {
    const messages: OpenAI.ChatCompletionMessageParam[] = contextMessages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    messages.push({ role: 'user', content: userMessage });

    const completion = await this.openai!.chat.completions.create({
      model: config.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: 'auto',
      max_tokens: 300,
      temperature: 0.1,
    });

    const choice = completion.choices[0];
    if (!choice) {
      return { intent: ChatIntentType.UNCLEAR, confidence: 0, entities: null };
    }

    // If the model invoked a tool, parse the structured output
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0] as any;
      const args = JSON.parse(toolCall.function.arguments);
      return this.toolCallToIntent(toolCall.function.name, args);
    }

    // No tool call — treat as general chat or advice
    const content = choice.message.content || '';
    return {
      intent: ChatIntentType.GENERAL_CHAT,
      confidence: 0.7,
      entities: null,
      fallbackMessage: content,
    };
  }

  private toolCallToIntent(functionName: string, args: Record<string, unknown>): ParsedIntent {
    switch (functionName) {
      case 'log_transaction':
        return {
          intent: args.type === 'income' ? ChatIntentType.LOG_INCOME : ChatIntentType.LOG_EXPENSE,
          confidence: 0.95,
          entities: {
            amount: args.amount as number,
            description: args.description as string,
            category: (args.category as string) || null,
            type: args.type as 'income' | 'expense',
            date: (args.date as string) || null,
          },
        };
      case 'query_spending':
        return {
          intent: (args.type === 'income') ? ChatIntentType.QUERY_INCOME : ChatIntentType.QUERY_SPENDING,
          confidence: 0.9,
          entities: {
            category: (args.category as string) || null,
            timeRange: ((args.timeRange as string) || 'this_month') as QueryEntities['timeRange'],
            startDate: null,
            endDate: null,
            type: (args.type as 'income' | 'expense' | 'both') || 'expense',
          } satisfies QueryEntities,
        };
      case 'set_budget':
        return {
          intent: ChatIntentType.SET_BUDGET,
          confidence: 0.9,
          entities: {
            category: args.category as string,
            amount: args.amount as number,
            period: (args.period as 'monthly' | 'weekly') || 'monthly',
          },
        };
      case 'get_advice':
        return {
          intent: ChatIntentType.GET_ADVICE,
          confidence: 0.9,
          entities: null,
          fallbackMessage: args.topic as string,
        };
      default:
        return { intent: ChatIntentType.UNCLEAR, confidence: 0, entities: null };
    }
  }

  private buildUnclearResponse(): ParsedIntent {
    return {
      intent: ChatIntentType.UNCLEAR,
      confidence: 0,
      entities: null,
      fallbackMessage:
        'I can help with expense logging, income logging, budget status, and monthly summaries. Try "Spent 400 on burger", "60000 salary", "Check budget", or "Monthly summary".',
      isFallback: true,
    };
  }

  private parseDeterministically(message: string): ParsedIntent | null {
    if (!message) return null;
    const text = message.toLowerCase().replace(/\s+/g, ' ').trim();

    // 1) Set budget commands must be evaluated before budget query checks.
    const setBudgetPatterns = [
      /(?:set|create|update)\s+([a-z][a-z0-9 &'/-]{1,40})\s+budget\s+(?:to|for)\s*(?:₹|rs\.?\s*|inr\s*)?([\d,.]+(?:\.\d{1,2})?)(?:\s*(weekly|monthly))?/i,
      /(?:set|create|update)\s+budget\s+(?:of\s+)?(?:₹|rs\.?\s*|inr\s*)?([\d,.]+(?:\.\d{1,2})?)(?:\s*(weekly|monthly))?\s+(?:for|on)\s+([a-z][a-z0-9 &'/-]{1,40})/i,
      /^([a-z][a-z0-9 &'/-]{1,40})\s+budget\s+(?:to|is)\s*(?:₹|rs\.?\s*|inr\s*)?([\d,.]+(?:\.\d{1,2})?)(?:\s*(weekly|monthly))?/i,
    ];

    for (const pattern of setBudgetPatterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const captures = match.slice(1).filter(Boolean);
      const category = captures.find((v) => /[a-z]/i.test(v) && !/(weekly|monthly)/i.test(v)) || '';
      const rawAmount = captures.find((v) => /\d/.test(v)) || '';
      const period = (captures.find((v) => /(weekly|monthly)/i.test(v)) || 'monthly').toLowerCase();
      const amount = this.parseAmount(rawAmount);

      if (category && amount > 0) {
        return {
          intent: ChatIntentType.SET_BUDGET,
          confidence: 0.92,
          entities: {
            category: this.toTitleCase(category),
            amount,
            period: period === 'weekly' ? 'weekly' : 'monthly',
          },
        };
      }
    }

    // 2) Budget status queries
    const budgetQueryPattern =
      /\b(check|show|view|see|status|summary)\b.*\bbudget(s)?\b|\bbudget(s)?\s+(status|summary)\b|^(my\s+)?budgets?$/i;
    if (budgetQueryPattern.test(text)) {
      return {
        intent: ChatIntentType.QUERY_BUDGET,
        confidence: 0.92,
        entities: null,
      };
    }

    // 3) Advice intent
    const advicePattern =
      /\b(advice|suggest|recommend|improve|optimi[sz]e|save more|reduce expenses|plan finances|financial plan|investment plan)\b/i;
    if (advicePattern.test(text)) {
      return {
        intent: ChatIntentType.GET_ADVICE,
        confidence: 0.82,
        entities: null,
        fallbackMessage: message,
      };
    }

    // 4) Spending/income queries (works when OpenAI is unavailable)
    const hasQueryVerb = /\b(how much|total|summary|report|show|tell me|what is|what did)\b/i.test(text);
    const hasFinanceSignal = /\b(spend|spent|expense|expenses|income|earned|earn|received)\b/i.test(text);
    const isTimeOnlyChip = /^(today|yesterday|this week|last week|this month|last month|this year)$/i.test(text);
    const isMonthlySummary = /\b(monthly summary|month summary|monthly spending|spent this month|this month summary|month(ly)? report|monthly stats|month stats)\b/i.test(text);

    if ((hasQueryVerb && hasFinanceSignal) || isTimeOnlyChip || isMonthlySummary) {
      const type: QueryEntities['type'] = /\b(income|earned|earn|received)\b/i.test(text) && !/\b(spend|spent|expense|expenses)\b/i.test(text)
        ? 'income'
        : 'expense';
      const timeRange = this.extractTimeRange(text);
      const category = this.extractCategoryFromQuery(text);

      return {
        intent: type === 'income' ? ChatIntentType.QUERY_INCOME : ChatIntentType.QUERY_SPENDING,
        confidence: 0.9,
        entities: {
          category,
          timeRange,
          startDate: null,
          endDate: null,
          type,
        },
      };
    }

    // 5) Income shorthand ("60000 salary", "salary 60000", typos included)
    const incomePattern = /\b(got|received|salary|salay|sallary|income|credited|earned|paycheck)\b.*(?:₹|rs\.?|inr)?\s*\d+|^\s*(?:₹|rs\.?|inr)?\s*[\d,.]+(?:\.\d{1,2})?\s*(salary|salay|sallary|income|earned)\b/i;
    const amountMatch = text.match(/(?:₹|rs\.?\s*|inr\s*)?([\d,.]+(?:\.\d{1,2})?)/i);
    if (incomePattern.test(text) && amountMatch) {
      const amount = this.parseAmount(amountMatch[1]);
      if (!Number.isNaN(amount) && amount > 0) {
        return {
          intent: ChatIntentType.LOG_INCOME,
          confidence: 0.9,
          entities: {
            amount,
            description: 'salary',
            category: 'Salary',
            type: 'income',
            date: null,
          },
        };
      }
    }

    return null;
  }

  private parseAmount(raw: string): number {
    if (!raw) return 0;
    const normalized = raw.toLowerCase().replace(/,/g, '').trim();
    const value = parseFloat(normalized);
    if (Number.isNaN(value)) return 0;
    if (normalized.endsWith('k')) return value * 1000;
    if (/(lakh|lac)$/.test(normalized)) return value * 100000;
    return value;
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
    const raw = categoryMatch[1]
      .replace(/\b(today|yesterday|this week|last week|this month|last month|this year)\b/gi, '')
      .trim();
    if (!raw) {
      return null;
    }
    return this.toTitleCase(raw);
  }

  private toTitleCase(input: string): string {
    return input
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
