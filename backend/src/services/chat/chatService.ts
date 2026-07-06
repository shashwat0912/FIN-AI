import prisma from '../../config/database';
import logger from '../../config/logger';
import {
  ChatIntentType,
  ChatResponsePayload,
  TransactionEntities,
  QueryEntities,
  BudgetEntities,
  BulkTransactionEntities,
  ConfirmationCard,
  ConversationStateType,
} from '../../types';
import { IntentParser } from './intentParser';
import { ContextManager } from './contextManager';
import { ConversationStateMachine } from './conversationStateMachine';
import { DateResolver } from './dateResolver';
import { AiService } from '../aiService';

interface BulkTransactionItem {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  categoryHint?: string | null;
}

interface BulkTransactionParseResult {
  items: BulkTransactionItem[];
  skippedLines: string[];
}

interface BulkHeaderContext {
  type: 'income' | 'expense';
  categoryHint: string | null;
}

export class ChatService {
  private intentParser: IntentParser;
  private contextManager: ContextManager;
  private fsm: ConversationStateMachine;
  private dateResolver: DateResolver;
  private aiService: AiService;

  constructor() {
    this.intentParser = new IntentParser();
    this.contextManager = new ContextManager();
    this.fsm = new ConversationStateMachine();
    this.dateResolver = new DateResolver();
    this.aiService = new AiService();
  }

  async processMessage(userId: string, content: string): Promise<ChatResponsePayload> {
    const currentState = await this.fsm.getState(userId);

    // Handle clarification flows
    if (currentState.state === 'AWAITING_CATEGORY') {
      return this.handleCategorySelection(userId, content, currentState);
    }
    if (currentState.state === 'AWAITING_EXPENSE_DETAILS') {
      return this.handleExpenseDetailsInput(userId, content);
    }
    if (currentState.state === 'AWAITING_CONFIRMATION') {
      return this.handleConfirmationInput(userId, content, currentState);
    }
    if (currentState.state === 'AWAITING_EDIT_DETAILS') {
      return this.handleEditDetailsInput(userId, content, currentState);
    }

    // Persist user message
    const userMessage = await prisma.chatMessage.create({
      data: { userId, role: 'USER', content, tokenCount: Math.ceil(content.split(/\s+/).length / 0.75) },
    });

    const normalizedContent = content.trim().replace(/\s+/g, ' ');

    if (this.isStartExpenseCaptureCommand(normalizedContent)) {
      const response = await this.startExpenseCapture(userId);
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: response.message,
          intent: ChatIntentType.LOG_EXPENSE,
          metadata: null,
          tokenCount: Math.ceil(response.message.split(/\s+/).length / 0.75),
        },
      });
      return response;
    }

    await this.fsm.transition(userId, 'MESSAGE_RECEIVED');

    // Handle multi-line / multi-item expense or income list before collapsing whitespace.
    // Example:
    // netflix 500
    // hotstar 300
    // youtube 300
    const bulkParse = this.tryParseBulkTransactionList(content);
    if (bulkParse && bulkParse.items.length >= 2) {
      return this.handleBulkTransactionConfirmation(userId, bulkParse, userMessage.id);
    }

    const singleParsedLine = this.parseBulkTransactionLine(content, 'expense', null);
    if (singleParsedLine) {
      return this.handleLogTransaction(
        userId,
        {
          amount: singleParsedLine.amount,
          description: singleParsedLine.description,
          category: singleParsedLine.categoryHint || null,
          type: singleParsedLine.type,
          date: null,
        },
        { isFallback: true },
        userMessage.id
      );
    }

    // Normalize so "50   dosa" parses like "50 dosa"
    const contextMessages = await this.contextManager.buildContextWindow(userId, content);
    const parsed = await this.intentParser.parse(normalizedContent, contextMessages);

    let response: ChatResponsePayload;

    switch (parsed.intent) {
      case ChatIntentType.LOG_EXPENSE:
      case ChatIntentType.LOG_INCOME:
        response = await this.handleLogTransaction(userId, parsed.entities as TransactionEntities, parsed, userMessage.id);
        break;
      case ChatIntentType.QUERY_SPENDING:
      case ChatIntentType.QUERY_INCOME:
        response = await this.handleQuerySpending(userId, parsed.entities as QueryEntities);
        break;
      case ChatIntentType.QUERY_BUDGET:
        response = await this.handleQueryBudget(userId);
        break;
      case ChatIntentType.SET_BUDGET:
        response = await this.handleSetBudget(userId, parsed.entities as BudgetEntities);
        break;
      case ChatIntentType.GET_ADVICE:
        response = await this.handleGetAdvice(userId, parsed.fallbackMessage || content);
        break;
      case ChatIntentType.GENERAL_CHAT:
        response = this.makeResponse(parsed.fallbackMessage || "I can help you log transactions, check spending, manage budgets, or get financial advice. What would you like to do?");
        await this.fsm.transition(userId, 'RESPONSE_SENT');
        break;
      default:
        response = this.makeResponse(
          parsed.fallbackMessage || 'I can help with expense logging, income logging, budget status, and monthly summaries. Try "Spent 400 on burger", "60000 salary", "Check budget", or "Monthly summary".',
          { suggestedChips: ['Log expense', 'Log income', 'Check budget', 'Monthly summary', 'Get advice'] }
        );
        await this.fsm.transition(userId, 'RESPONSE_SENT');
    }

    response.isFallbackMode = parsed.isFallback || false;

    // Persist assistant message only if handler did not already create one for confirmation state.
    if (!response.confirmationCard) {
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: response.message,
          intent: parsed.intent,
          metadata: null,
          tokenCount: Math.ceil(response.message.split(/\s+/).length / 0.75),
        },
      });
    }

    return response;
  }

  async confirmAction(userId: string, confirmationId: string): Promise<ChatResponsePayload> {
    const pending = await prisma.pendingConfirmation.findFirst({
      where: { id: confirmationId, userId, status: 'PENDING' },
    });

    if (!pending) {
      return this.makeResponse('No pending action found. It may have expired.');
    }

    const data = JSON.parse(pending.data);

    if (pending.type === 'transaction') {
      const txnData = data as TransactionEntities;
      await prisma.transaction.create({
        data: {
          userId,
          amount: txnData.amount,
          description: txnData.description,
          category: txnData.category || 'Uncategorized',
          type: txnData.type === 'income' ? 'INCOME' : 'EXPENSE',
          source: 'chat',
          date: txnData.date ? new Date(txnData.date) : new Date(),
        },
      });

      await prisma.pendingConfirmation.update({
        where: { id: confirmationId },
        data: { status: 'CONFIRMED', resolvedAt: new Date() },
      });

      await this.fsm.transition(userId, 'CONFIRMED');

      const message = `Logged ₹${txnData.amount.toLocaleString('en-IN')} as ${txnData.category || 'Uncategorized'}\n${txnData.description} · Today`;
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: message,
          intent: txnData.type === 'income' ? ChatIntentType.LOG_INCOME : ChatIntentType.LOG_EXPENSE,
          metadata: null,
          tokenCount: Math.ceil(message.split(/\s+/).length / 0.75),
        },
      });

      return this.makeResponse(message, { suggestedChips: ['Log another', 'Check budget', 'Monthly summary'] });
    }

    if (pending.type === 'budget') {
      const budgetData = data as BudgetEntities;
      await prisma.budget.create({
        data: {
          userId,
          name: budgetData.category,
          amount: budgetData.amount,
          period: budgetData.period === 'weekly' ? 'WEEKLY' : 'MONTHLY',
        },
      });

      await prisma.pendingConfirmation.update({
        where: { id: confirmationId },
        data: { status: 'CONFIRMED', resolvedAt: new Date() },
      });

      await this.fsm.transition(userId, 'CONFIRMED');

      const message = `✅ Budget set! ${budgetData.category}: ₹${budgetData.amount.toLocaleString('en-IN')} per ${budgetData.period}.`;
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: message,
          intent: ChatIntentType.SET_BUDGET,
          metadata: null,
          tokenCount: Math.ceil(message.split(/\s+/).length / 0.75),
        },
      });

      return this.makeResponse(message);
    }

    if (pending.type === 'bulk_transaction') {
      const bulkData = data as BulkTransactionEntities;
      await this.saveBulkTransactions(userId, bulkData.items);

      await prisma.pendingConfirmation.update({
        where: { id: confirmationId },
        data: { status: 'CONFIRMED', resolvedAt: new Date() },
      });

      await this.fsm.transition(userId, 'CONFIRMED');

      const message = this.buildBulkLogSuccessMessage(bulkData.items, bulkData.skippedLines || []);
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: message,
          intent: bulkData.items.every((item) => item.type === 'income') ? ChatIntentType.LOG_INCOME : ChatIntentType.LOG_EXPENSE,
          metadata: null,
          tokenCount: Math.ceil(message.split(/\s+/).length / 0.75),
        },
      });

      return this.makeResponse(message, {
        suggestedChips: ['Monthly summary', 'Check budget', 'Log more'],
      });
    }

    return this.makeResponse('Unknown confirmation type.');
  }

  async editAction(userId: string, confirmationId: string, updates: Partial<TransactionEntities | BudgetEntities>): Promise<ChatResponsePayload> {
    const pending = await prisma.pendingConfirmation.findFirst({
      where: { id: confirmationId, userId, status: 'PENDING' },
    });

    if (!pending) {
      return this.makeResponse('No pending action found to edit.');
    }

    if (pending.type === 'bulk_transaction') {
      const card: ConfirmationCard = {
        id: confirmationId,
        type: 'bulk_transaction',
        data: JSON.parse(pending.data) as BulkTransactionEntities,
        status: 'PENDING',
      };

      return this.makeResponse('Bulk editing is not available. Cancel and send a corrected list.', {
        confirmationCard: card,
        conversationState: 'AWAITING_CONFIRMATION',
      });
    }

    const currentData = JSON.parse(pending.data);
    let updatedData =
      pending.type === 'transaction'
        ? this.applyTransactionUpdates(currentData as TransactionEntities, updates)
        : this.applyBudgetUpdates(currentData as BudgetEntities, updates);

    if (
      pending.type === 'transaction' &&
      'description' in updates &&
      !('category' in updates)
    ) {
      const txnData = updatedData as TransactionEntities;
      const inferredCategory = await this.inferCategory(userId, txnData);
      txnData.category =
        this.normalizeCategoryLabel(inferredCategory, txnData.type, txnData.description) ||
        (txnData.type === 'income' ? 'Other Income' : 'Miscellaneous');
      updatedData = txnData;
    }

    await prisma.pendingConfirmation.update({
      where: { id: confirmationId },
      data: { data: JSON.stringify(updatedData), status: 'PENDING' },
    });

    const card: ConfirmationCard = {
      id: confirmationId,
      type: pending.type as 'transaction' | 'budget',
      data: updatedData,
      status: 'PENDING',
    };

    await this.fsm.transition(userId, 'EDIT_APPLIED', { pendingConfirmationId: confirmationId });

    return this.makeResponse('Updated. Please confirm:', {
      confirmationCard: card,
      conversationState: 'AWAITING_CONFIRMATION',
    });
  }

  async cancelAction(userId: string, confirmationId: string): Promise<ChatResponsePayload> {
    const pending = await prisma.pendingConfirmation.findFirst({
      where: { id: confirmationId, userId, status: 'PENDING' },
    });

    const sourceUserMessageId = pending ? this.getSourceUserMessageId(pending.data) : null;

    if (sourceUserMessageId) {
      await prisma.chatMessage.updateMany({
        where: { id: sourceUserMessageId, userId, role: 'USER' },
        data: {
          metadata: JSON.stringify({
            hiddenFromChat: true,
            hiddenReason: 'cancelled_confirmation',
          }),
        },
      });
    }

    if (pending) {
      await prisma.pendingConfirmation.update({
        where: { id: confirmationId },
        data: { status: 'CANCELLED', resolvedAt: new Date() },
      });
    }

    await this.fsm.transition(userId, 'CANCELLED');

    return this.makeResponse('', {
      metadata: sourceUserMessageId ? JSON.stringify({ hiddenMessageId: sourceUserMessageId }) : null,
    });
  }

  async getHistory(userId: string, limit: number = 50, offset: number = 0) {
    const messages = await prisma.chatMessage.findMany({
      where: { userId, role: { not: 'SYSTEM' }, pendingConfirmation: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        role: true,
        content: true,
        intent: true,
        metadata: true,
        createdAt: true,
      },
    });
    return messages.reverse().filter((message) => !this.isHiddenFromChat(message.metadata));
  }

  private getSourceUserMessageId(rawData: string): string | null {
    try {
      const data = JSON.parse(rawData);
      return typeof data?.sourceUserMessageId === 'string' ? data.sourceUserMessageId : null;
    } catch {
      return null;
    }
  }

  private isHiddenFromChat(metadata: string | null): boolean {
    if (!metadata) return false;
    try {
      return JSON.parse(metadata)?.hiddenFromChat === true;
    } catch {
      return false;
    }
  }

  // --- Private handlers ---

  private async handleLogTransaction(
    userId: string,
    entities: TransactionEntities,
    _parsed: { isFallback?: boolean },
    sourceUserMessageId?: string
  ): Promise<ChatResponsePayload> {
    entities.description = this.normalizeTransactionDescription(entities.description, entities.type);
    entities.category = this.normalizeCategoryLabel(entities.category, entities.type, entities.description);

    if (!entities.category || this.isGenericCategory(entities.category)) {
      entities.category = await this.inferCategory(userId, entities);
    }
    entities.category =
      this.normalizeCategoryLabel(entities.category, entities.type, entities.description) ||
      (entities.type === 'income' ? 'Other Income' : 'Miscellaneous');

    await this.learnCategoryMapping(userId, entities.description, entities.category || 'Miscellaneous');

    const emoji = entities.type === 'income' ? '💰' : '💸';
    const confirmationMessage = `${emoji} ₹${entities.amount.toLocaleString('en-IN')} — ${entities.category} (${entities.description}). Confirm?`;

    const card = await this.createPendingConfirmation(
      userId,
      confirmationMessage,
      entities.type === 'income' ? ChatIntentType.LOG_INCOME : ChatIntentType.LOG_EXPENSE,
      'transaction',
      entities,
      20,
      sourceUserMessageId
    );

    return this.makeResponse(
      confirmationMessage,
      { confirmationCard: card, conversationState: 'AWAITING_CONFIRMATION' }
    );
  }

  private async inferCategory(userId: string, entities: TransactionEntities): Promise<string> {
    const description = entities.description.toLowerCase().trim();
    const defaultCategory = entities.type === 'income' ? 'Other Income' : 'Miscellaneous';

    if (!description) return defaultCategory;

    const exactLearned = await prisma.categoryMapping.findUnique({
      where: { userId_keyword: { userId, keyword: description } },
    });
    if (exactLearned?.category && !this.isGenericCategory(exactLearned.category)) {
      return this.normalizeCategoryLabel(exactLearned.category, entities.type, description) || exactLearned.category;
    }

    const learnedMappings = await prisma.categoryMapping.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
      take: 100,
      select: { keyword: true, category: true },
    });
    for (const mapping of learnedMappings) {
      if (this.isGenericCategory(mapping.category)) continue;
      if (this.keywordMatches(description, mapping.keyword)) {
        return this.normalizeCategoryLabel(mapping.category, entities.type, description) || mapping.category;
      }
    }

    const staticCategory = this.getStaticCategoryFromDescription(description, entities.type);
    return staticCategory || defaultCategory;
  }

  private keywordMatches(text: string, keyword: string): boolean {
    const normalizedText = text.toLowerCase().trim();
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (!normalizedKeyword) return false;
    if (normalizedText === normalizedKeyword) return true;
    if (normalizedKeyword.length >= 3 && normalizedText.includes(normalizedKeyword)) return true;
    const keywordParts = normalizedKeyword.split(/\s+/).filter((p) => p.length >= 4);
    return keywordParts.some((p) => normalizedText.includes(p));
  }

  private getStaticCategoryFromDescription(description: string, type: 'income' | 'expense'): string | null {
    const expenseKeywords: Record<string, string[]> = {
      Food: [
        'food', 'meal', 'restaurant', 'hotel', 'canteen', 'dinner', 'lunch', 'breakfast', 'brunch', 'snack',
        'taco', 'burger', 'pizza', 'sandwich', 'subway', 'idli', 'idle', 'dosa', 'masala dosa', 'uttapam',
        'vada', 'vada pav', 'samosa', 'pav bhaji', 'roll', 'wrap', 'coffee', 'tea', 'chai', 'cold coffee',
        'cold drink', 'juice', 'biryani', 'biriyani', 'icecream', 'ice cream', 'kulfi', 'dessert', 'sweet',
        'sweets', 'mithai', 'cake', 'pastry', 'pani puri', 'golgappa', 'puchka', 'zomato', 'swiggy', 'grocery', 'groceries',
      ],
      Transport: ['transport', 'travel', 'uber', 'ola', 'cab', 'taxi', 'auto', 'metro', 'bus', 'train', 'fuel', 'petrol', 'diesel', 'toll', 'parking'],
      Shopping: ['shopping', 'shop', 'amazon', 'flipkart', 'myntra', 'clothes', 'shirt', 'shoes', 'purchase', 'bought'],
      Rent: ['rent', 'landlord', 'house rent', 'flat rent'],
      Health: ['health', 'doctor', 'hospital', 'medicine', 'medical', 'pharmacy', 'clinic'],
      Entertainment: [
        'movie', 'cinema', 'netflix', 'hotstar', 'youtube', 'prime video', 'amazon prime',
        'spotify', 'game', 'concert', 'party', 'entertainment',
      ],
      Utilities: ['electricity', 'water bill', 'internet', 'wifi', 'mobile bill', 'recharge', 'gas bill'],
      Education: ['course', 'tuition', 'fees', 'education', 'book', 'books'],
      Investment: [
        'sip', 'systematic investment plan', 'mutual fund', 'mf', 'elss', 'etf', 'index fund',
        'stock', 'stocks', 'share', 'shares', 'equity', 'nifty bees', 'sensex bees', 'smallcase',
        'zerodha', 'groww', 'upstox', 'coin', 'demat', 'ppf', 'nps', 'fixed deposit', 'fd',
        'recurring deposit', 'rd', 'gold bond', 'sovereign gold bond', 'sgb', 'crypto', 'bitcoin',
        'ethereum', 'investment',
      ],
      Savings: ['savings', 'saving', 'emergency fund', 'rainy day fund', 'sinking fund'],
      Insurance: ['insurance', 'premium', 'term plan', 'health insurance', 'life insurance', 'mediclaim'],
      Loan: ['emi', 'loan', 'credit card bill', 'debt payment', 'repayment'],
    };
    const incomeKeywords: Record<string, string[]> = {
      Salary: ['salary', 'salay', 'sallary', 'paycheck', 'pay day', 'payslip', 'ctc'],
      Freelance: ['freelance', 'client', 'project payment', 'gig', 'consulting'],
      Business: ['business', 'sales', 'revenue', 'store payout'],
      Investment: ['dividend', 'capital gain', 'profit booking', 'sip return', 'mutual fund return', 'investment return', 'stock profit', 'redemption'],
      Interest: ['interest', 'fd interest', 'bank interest'],
      Refund: ['refund', 'cashback', 'reimbursement', 'repaid', 'money back'],
      Gift: ['gift', 'present', 'cash gift'],
    };
    const keywordMap = type === 'income' ? incomeKeywords : expenseKeywords;
    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((kw) => this.keywordMatches(description, kw))) return category;
    }
    return null;
  }

  private async learnCategoryMapping(userId: string, description: string, category: string): Promise<void> {
    const keyword = description.toLowerCase().trim();
    if (!keyword || !category || ['Miscellaneous', 'Other Income'].includes(category)) return;
    try {
      const existing = await prisma.categoryMapping.findUnique({
        where: { userId_keyword: { userId, keyword } },
      });
      if (!existing) {
        await prisma.categoryMapping.create({
          data: { userId, keyword, category, confidence: 0.85 },
        });
        return;
      }
      if (existing.confidence >= 0.95 && existing.category !== category) return;
      const nextConfidence = Math.max(existing.confidence, 0.85);
      if (existing.category !== category || existing.confidence !== nextConfidence) {
        await prisma.categoryMapping.update({
          where: { id: existing.id },
          data: { category, confidence: nextConfidence },
        });
      }
    } catch (error: unknown) {
      logger.warn('Could not persist category mapping', {
        userId,
        keyword,
        category,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private async handleQuerySpending(userId: string, entities: QueryEntities): Promise<ChatResponsePayload> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const tz = user?.timezone || 'Asia/Kolkata';
    const { startDate, endDate } = this.dateResolver.resolveTimeRange(entities.timeRange, tz);

    const where: any = { userId, date: { gte: startDate, lte: endDate } };
    if (entities.category) where.category = entities.category;
    if (entities.type !== 'both') where.type = entities.type === 'income' ? 'INCOME' : 'EXPENSE';

    const transactions = await prisma.transaction.findMany({ where });
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const count = transactions.length;

    // Build category breakdown for chart
    const catBreakdown: Record<string, number> = {};
    transactions.forEach((t) => {
      catBreakdown[t.category] = (catBreakdown[t.category] || 0) + Number(t.amount);
    });

    const sorted = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);
    const chartData = sorted.length > 0
      ? { type: 'bar' as const, labels: sorted.map(([c]) => c), values: sorted.map(([, v]) => v), title: `Spending by category` }
      : null;

    const typeLabel = entities.type === 'income' ? 'earned' : 'spent';
    const catLabel = entities.category ? ` on ${entities.category}` : '';
    const message = `You ${typeLabel} ₹${total.toLocaleString('en-IN')}${catLabel} (${entities.timeRange.replace('_', ' ')}) across ${count} transaction(s).`;

    await this.fsm.transition(userId, 'RESPONSE_SENT');

    return this.makeResponse(message, {
      chartData,
      suggestedChips: ['This week', 'Last month', 'Log expense'],
    });
  }

  private async handleSetBudget(userId: string, entities: BudgetEntities): Promise<ChatResponsePayload> {
    const confirmationMessage = `📊 Set ${entities.category} budget to ₹${entities.amount.toLocaleString('en-IN')}/${entities.period}. Confirm?`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const assistantMsg = await prisma.chatMessage.create({
      data: {
        userId,
        role: 'ASSISTANT',
        content: confirmationMessage,
        intent: ChatIntentType.SET_BUDGET,
        tokenCount: 20,
      },
    });

    const pending = await prisma.pendingConfirmation.create({
      data: {
        userId,
        chatMessageId: assistantMsg.id,
        type: 'budget',
        data: JSON.stringify(entities),
        expiresAt,
      },
    });

    await this.fsm.transition(userId, 'INTENT_PARSED', { pendingConfirmationId: pending.id });

    const card: ConfirmationCard = {
      id: pending.id,
      type: 'budget',
      data: entities,
      status: 'PENDING',
    };

    return this.makeResponse(confirmationMessage, {
      confirmationCard: card,
      conversationState: 'AWAITING_CONFIRMATION',
    });
  }

  private async handleQueryBudget(userId: string): Promise<ChatResponsePayload> {
    const budgets = await prisma.budget.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (budgets.length === 0) {
      await this.fsm.transition(userId, 'RESPONSE_SENT');
      return this.makeResponse('No active budgets found. You can set one by saying "Set food budget to 5000 this month".', {
        suggestedChips: ['Set food budget', 'Set transport budget', 'Monthly summary'],
      });
    }

    const summary = budgets
      .map((b) => `${b.name}: ₹${Number(b.spent).toLocaleString('en-IN')} / ₹${Number(b.amount).toLocaleString('en-IN')}`)
      .join('\n');

    await this.fsm.transition(userId, 'RESPONSE_SENT');
    return this.makeResponse(`Budget status:\n${summary}`, {
      suggestedChips: ['How much did I spend this month?', 'Log expense'],
    });
  }

  private async handleGetAdvice(userId: string, query: string): Promise<ChatResponsePayload> {
    try {
      const result = await this.aiService.getFinancialAdvice(userId, { query });
      await this.fsm.transition(userId, 'RESPONSE_SENT');
      return this.makeResponse(result.advice, {
        suggestedChips: ['Tell me more', 'Log expense', 'Monthly summary'],
      });
    } catch {
      await this.fsm.transition(userId, 'RESPONSE_SENT');
      return this.makeResponse(
        'Sorry, I couldn\'t generate advice right now. Please try again.',
        { suggestedChips: ['Try again', 'Log expense', 'Check budget'] }
      );
    }
  }

  private async handleCategorySelection(
    userId: string,
    content: string,
    state: any
  ): Promise<ChatResponsePayload> {
    // Clean up emoji prefixes from chip selection
    const category = content.replace(/^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\s]+/u, '').trim();

    if (!category) {
      await this.fsm.transition(userId, 'CLARIFICATION_RETRY');
      return this.makeResponse('Please select or type a category name.', {
        conversationState: 'AWAITING_CATEGORY',
      });
    }

    const pendingData = state.pendingData as TransactionEntities;
    if (!pendingData) {
      await this.fsm.resetToIdle(userId);
      return this.makeResponse('Something went wrong. Please try again.', {
        suggestedChips: ['Log expense', 'Log income'],
      });
    }

    pendingData.category = category;

    // Learn the mapping
    await prisma.categoryMapping.upsert({
      where: { userId_keyword: { userId, keyword: pendingData.description.toLowerCase() } },
      update: { category, confidence: 1.0 },
      create: { userId, keyword: pendingData.description.toLowerCase(), category, confidence: 1.0 },
    });

    await prisma.chatMessage.create({
      data: { userId, role: 'USER', content, tokenCount: 5 },
    });

    // Now create the confirmation
    const parsed = { isFallback: false };
    return this.handleLogTransaction(userId, pendingData, parsed);
  }

  private async handleExpenseDetailsInput(
    userId: string,
    content: string
  ): Promise<ChatResponsePayload> {
    const lower = content.toLowerCase().trim();

    await prisma.chatMessage.create({
      data: { userId, role: 'USER', content, tokenCount: Math.ceil(content.split(/\s+/).length / 0.75) },
    });

    if (['cancel', 'no', 'nope', 'stop', 'never mind', 'nevermind', 'n'].includes(lower)) {
      await this.fsm.transition(userId, 'CANCELLED');
      const response = this.makeResponse('No problem. Expense logging cancelled.', {
        suggestedChips: ['Log expense', 'Check budget', 'Monthly summary'],
      });
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: response.message,
          intent: ChatIntentType.GENERAL_CHAT,
          tokenCount: Math.ceil(response.message.split(/\s+/).length / 0.75),
        },
      });
      return response;
    }

    const entities = this.parseExpenseDetails(content);
    if (!entities) {
      await this.fsm.transition(userId, 'START_LOG_EXPENSE');
      const response = this.makeResponse(
        'Please include an amount and what it was for, like "400 burger", "1200 groceries", or "500 Uber".',
        {
          conversationState: 'AWAITING_EXPENSE_DETAILS',
          suggestedChips: ['Cancel'],
        }
      );
      await prisma.chatMessage.create({
        data: {
          userId,
          role: 'ASSISTANT',
          content: response.message,
          intent: ChatIntentType.LOG_EXPENSE,
          tokenCount: Math.ceil(response.message.split(/\s+/).length / 0.75),
        },
      });
      return response;
    }

    await this.fsm.transition(userId, 'EXPENSE_DETAILS_RECEIVED');
    return this.handleLogTransaction(userId, entities, { isFallback: true });
  }

  private async handleConfirmationInput(
    userId: string,
    content: string,
    state: any
  ): Promise<ChatResponsePayload> {
    const lower = content.toLowerCase().trim();

    if (['yes', 'confirm', 'confirm all', 'ok', 'done', 'add all', '✅', 'y'].includes(lower)) {
      if (state.pendingConfirmationId) {
        return this.confirmAction(userId, state.pendingConfirmationId);
      }
    }

    if (['no', 'cancel', 'nope', '❌', 'n'].includes(lower)) {
      if (state.pendingConfirmationId) {
        return this.cancelAction(userId, state.pendingConfirmationId);
      }
    }

    if (state.pendingConfirmationId) {
      if (['edit', 'change', 'update'].includes(lower)) {
        await prisma.chatMessage.create({
          data: { userId, role: 'USER', content, tokenCount: Math.ceil(content.split(/\s+/).length / 0.75) },
        });
        await this.fsm.transition(userId, 'EDIT_REQUESTED', { pendingConfirmationId: state.pendingConfirmationId });

        return this.makeResponse('What would you like to edit? For example: "change amount to 500" or "category Transport".', {
          conversationState: 'AWAITING_EDIT_DETAILS',
        });
      }

      const editUpdates = this.parseConfirmationEdit(content);
      if (editUpdates) {
        await prisma.chatMessage.create({
          data: { userId, role: 'USER', content, tokenCount: Math.ceil(content.split(/\s+/).length / 0.75) },
        });
        return this.editAction(userId, state.pendingConfirmationId, editUpdates);
      }

      await prisma.chatMessage.create({
        data: { userId, role: 'USER', content, tokenCount: Math.ceil(content.split(/\s+/).length / 0.75) },
      });

      return this.makeResponse('You already have a pending transaction. Please Confirm, Cancel, or Edit it first.', {
        conversationState: 'AWAITING_CONFIRMATION',
      });
    }

    // Treat as unrelated message — reset state and process fresh
    await this.fsm.resetToIdle(userId);
    return this.processMessage(userId, content);
  }

  private async handleEditDetailsInput(
    userId: string,
    content: string,
    state: any
  ): Promise<ChatResponsePayload> {
    const lower = content.toLowerCase().trim();

    if (['yes', 'confirm', 'confirm all', 'ok', 'done', 'add all', '✅', 'y'].includes(lower) && state.pendingConfirmationId) {
      return this.confirmAction(userId, state.pendingConfirmationId);
    }

    if (['no', 'cancel', 'nope', '❌', 'n'].includes(lower) && state.pendingConfirmationId) {
      return this.cancelAction(userId, state.pendingConfirmationId);
    }

    await prisma.chatMessage.create({
      data: { userId, role: 'USER', content, tokenCount: Math.ceil(content.split(/\s+/).length / 0.75) },
    });

    if (!state.pendingConfirmationId) {
      await this.fsm.resetToIdle(userId);
      return this.makeResponse('No pending action found to edit.');
    }

    if (['edit', 'change', 'update'].includes(lower)) {
      await this.fsm.transition(userId, 'EDIT_REQUESTED', { pendingConfirmationId: state.pendingConfirmationId });
      return this.makeResponse('What would you like to edit? For example: "300 noodles", "500", or "category Transport".', {
        conversationState: 'AWAITING_EDIT_DETAILS',
      });
    }

    const editUpdates = this.parseEditDetails(content);
    if (editUpdates) {
      return this.editAction(userId, state.pendingConfirmationId, editUpdates);
    }

    return this.makeResponse('Please tell me what to edit, like "300 noodles", "500", "category Transport", or "description to burger meal".', {
      conversationState: 'AWAITING_EDIT_DETAILS',
    });
  }

  private makeResponse(
    message: string,
    overrides?: Partial<ChatResponsePayload>
  ): ChatResponsePayload {
    return {
      message,
      confirmationCard: null,
      chartData: null,
      conversationState: 'IDLE',
      rateLimitInfo: null,
      isFallbackMode: false,
      ...overrides,
      suggestedChips: [],
    };
  }

  private isStartExpenseCaptureCommand(content: string): boolean {
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    return /^(log|add|record|track)\s+(an?\s+)?expense$/.test(normalized);
  }

  private async startExpenseCapture(userId: string): Promise<ChatResponsePayload> {
    await this.fsm.transition(userId, 'START_LOG_EXPENSE', {
      lastIntent: ChatIntentType.LOG_EXPENSE,
      pendingConfirmationId: null,
      pendingData: null,
    });

    return this.makeResponse(
      'Sure. What did you spend on? Type the amount and details, like "400 burger", "1200 groceries", or "500 Uber".',
      {
        conversationState: 'AWAITING_EXPENSE_DETAILS',
        suggestedChips: ['Cancel'],
      }
    );
  }

  private parseExpenseDetails(content: string): TransactionEntities | null {
    const normalized = (content || '').replace(/\s+/g, ' ').trim();
    const naturalExpenseMatch =
      normalized.match(/(?:spent|paid|bought)\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\s*(?:on|for|at)\s+(.+)/i) ||
      normalized.match(/^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\s*(?:on|for|at)\s+(.+)/i);

    if (naturalExpenseMatch) {
      const amount = this.parseFlexibleAmount(naturalExpenseMatch[1]);
      const description = naturalExpenseMatch[2].trim();
      if (amount > 0 && description) {
        return {
          amount,
          description,
          category: null,
          type: 'expense',
          date: null,
        };
      }
    }

    const parsed = this.parseBulkTransactionLine(content, 'expense', null);
    if (!parsed || parsed.amount <= 0 || !parsed.description.trim()) {
      return null;
    }

    return {
      amount: parsed.amount,
      description: parsed.description,
      category: parsed.categoryHint || null,
      type: 'expense',
      date: null,
    };
  }

  private parseConfirmationEdit(content: string): Partial<TransactionEntities | BudgetEntities> | null {
    const raw = (content || '').trim();
    if (!raw) return null;

    const updates: Partial<TransactionEntities & BudgetEntities> = {};
    const amountMatch = raw.match(
      /\b(?:amount|price|cost|value|total)\s*(?:to|as|=|:)?\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\b/i
    ) || raw.match(
      /\b(?:change|update|set|make)\s+(?:it\s+)?(?:to\s+)?(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\b/i
    );

    if (amountMatch) {
      const amount = this.parseFlexibleAmount(amountMatch[1]);
      if (amount > 0) {
        updates.amount = amount;
      }
    }

    const categoryMatch = raw.match(/\b(?:category|cat)\s*(?:to|as|=|:)?\s*([a-z][a-z0-9 &'/-]{1,40})\b/i);
    if (categoryMatch) {
      updates.category = categoryMatch[1].trim();
    } else if (!amountMatch) {
      const makeCategoryMatch = raw.match(/^(?:make|set|change)\s+(?:it\s+)?(?:to\s+)?([a-z][a-z0-9 &'/-]{1,40})$/i);
      if (makeCategoryMatch) {
        updates.category = makeCategoryMatch[1].trim();
      }
    }

    const descriptionMatch = raw.match(/\b(?:description|desc|details?|note)\s*(?:to|as|=|:)?\s*(.+)$/i);
    if (descriptionMatch) {
      const description = descriptionMatch[1].trim();
      if (description) {
        updates.description = description;
      }
    }

    return Object.keys(updates).length > 0 ? updates : null;
  }

  private parseEditDetails(content: string): Partial<TransactionEntities | BudgetEntities> | null {
    const explicitUpdates = this.parseConfirmationEdit(content);
    if (explicitUpdates) return explicitUpdates;

    const raw = (content || '').trim().replace(/\s+/g, ' ');
    const amountWithDescription = raw.match(/^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\s+(.+)$/i);
    if (amountWithDescription) {
      const amount = this.parseFlexibleAmount(amountWithDescription[1]);
      const description = amountWithDescription[2].trim();
      if (amount > 0 && description) {
        return { amount, description };
      }
    }

    const amountOnly = raw.match(/^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)$/i);
    if (amountOnly) {
      const amount = this.parseFlexibleAmount(amountOnly[1]);
      if (amount > 0) {
        return { amount };
      }
    }

    return null;
  }

  private applyTransactionUpdates(
    currentData: TransactionEntities,
    updates: Partial<TransactionEntities | BudgetEntities>
  ): TransactionEntities {
    const currentType = currentData.type === 'income' ? 'income' : 'expense';
    const next: TransactionEntities = { ...currentData };
    const maybeAmount = Number((updates as Partial<TransactionEntities>).amount);

    if (Number.isFinite(maybeAmount) && maybeAmount > 0) {
      next.amount = maybeAmount;
    }

    if ('description' in updates && typeof (updates as Partial<TransactionEntities>).description === 'string') {
      const description = ((updates as Partial<TransactionEntities>).description || '').trim();
      if (description) {
        next.description = this.normalizeTransactionDescription(description, currentType);
      }
    }

    if ('category' in updates && typeof updates.category === 'string') {
      const category = this.normalizeCategoryLabel(updates.category, currentType, next.description);
      if (category) {
        next.category = category;
      }
    }

    if ('date' in updates && typeof (updates as Partial<TransactionEntities>).date === 'string') {
      const date = (updates as Partial<TransactionEntities>).date;
      if (date && !Number.isNaN(Date.parse(date))) {
        next.date = date;
      }
    }

    next.type = currentType;
    return next;
  }

  private applyBudgetUpdates(
    currentData: BudgetEntities,
    updates: Partial<TransactionEntities | BudgetEntities>
  ): BudgetEntities {
    const next: BudgetEntities = { ...currentData };
    const maybeAmount = Number(updates.amount);

    if (Number.isFinite(maybeAmount) && maybeAmount > 0) {
      next.amount = maybeAmount;
    }
    if ('category' in updates && typeof updates.category === 'string' && updates.category.trim()) {
      next.category = this.normalizeCategoryLabel(updates.category, 'expense') || updates.category.trim();
    }
    if ('period' in updates && (updates as Partial<BudgetEntities>).period) {
      const period = (updates as Partial<BudgetEntities>).period;
      if (period === 'weekly' || period === 'monthly') {
        next.period = period;
      }
    }

    return next;
  }

  private normalizeTransactionDescription(raw: string, type: 'income' | 'expense'): string {
    const description = (raw || '').trim().replace(/\s+/g, ' ');
    if (type === 'income' && /\b(salay|sallary)\b/i.test(description)) {
      return description.replace(/\b(salay|sallary)\b/gi, 'salary');
    }
    return description;
  }

  private isGenericCategory(category: string | null | undefined): boolean {
    const normalized = (category || '').toLowerCase().trim();
    return [
      'miscellaneous',
      'other income',
      'other expense',
      'uncategorized',
      'general',
      'others',
      'expense',
      'expenses',
      'income',
      'transaction',
      'unknown',
      'category',
    ].includes(normalized);
  }

  private normalizeCategoryLabel(
    category: string | null | undefined,
    type: 'income' | 'expense',
    description?: string
  ): string | null {
    const normalized = (category || '').trim();
    if (!normalized) return null;

    const normalizedLower = normalized.toLowerCase();
    const aliasMap: Record<'income' | 'expense', Record<string, string[]>> = {
      income: {
        Salary: ['salary', 'salary/wages', 'wages', 'payroll'],
        Freelance: ['freelance', 'freelancing', 'consulting', 'consultancy'],
        Business: ['business', 'business income'],
        Investment: ['investment', 'investment returns', 'dividend income', 'capital gains', 'capital gain'],
        Interest: ['interest', 'interest income'],
        Refund: ['refund', 'cashback', 'reimbursement'],
        Gift: ['gift', 'cash gift'],
      },
      expense: {
        Food: ['food', 'dining', 'groceries', 'grocery'],
        Transport: ['transport', 'travel', 'fuel'],
        Shopping: ['shopping', 'shopping & clothing', 'clothing'],
        Rent: ['rent', 'housing'],
        Health: ['health', 'healthcare', 'medical'],
        Entertainment: ['entertainment', 'entertainment & movies', 'movies', 'subscription', 'subscriptions', 'ott'],
        Utilities: ['utilities', 'bills', 'bills & utilities'],
        Education: ['education', 'education & courses', 'courses'],
        Investment: ['investment', 'investments', 'mutual fund sip', 'mutual funds', 'stocks', 'shares', 'etf', 'ppf', 'nps', 'fixed deposits'],
        Savings: ['savings', 'saving', 'emergency fund'],
        Insurance: ['insurance', 'premium'],
        Loan: ['loan', 'emi', 'debt'],
      },
    };

    for (const [canonical, aliases] of Object.entries(aliasMap[type])) {
      if (aliases.some((alias) => this.keywordMatches(normalizedLower, alias))) {
        return canonical;
      }
    }

    if (type === 'expense' && description) {
      const descriptionLower = description.toLowerCase();
      if (this.keywordMatches(descriptionLower, 'sip') || this.keywordMatches(descriptionLower, 'mutual fund')) {
        return 'Investment';
      }
    }

    return normalized
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async handleBulkTransactionConfirmation(
    userId: string,
    parsed: BulkTransactionParseResult,
    sourceUserMessageId?: string
  ): Promise<ChatResponsePayload> {
    const normalizedTransactions = await this.normalizeBulkTransactions(userId, parsed);
    const total = normalizedTransactions.reduce((sum, item) => sum + item.amount, 0);
    const confirmationMessage = `Review ${normalizedTransactions.length} transaction item(s), total ₹${total.toLocaleString('en-IN')}. Confirm all?`;
    const dominantIntent = normalizedTransactions.every((item) => item.type === 'income')
      ? ChatIntentType.LOG_INCOME
      : ChatIntentType.LOG_EXPENSE;
    const data: BulkTransactionEntities = {
      items: normalizedTransactions,
      skippedLines: parsed.skippedLines,
    };
    const card = await this.createPendingConfirmation(
      userId,
      confirmationMessage,
      dominantIntent,
      'bulk_transaction',
      data,
      Math.ceil(confirmationMessage.split(/\s+/).length / 0.75),
      sourceUserMessageId
    );

    return this.makeResponse(confirmationMessage, {
      confirmationCard: card,
      conversationState: 'AWAITING_CONFIRMATION',
    });
  }

  private async createPendingConfirmation(
    userId: string,
    message: string,
    intent: ChatIntentType,
    type: ConfirmationCard['type'],
    data: ConfirmationCard['data'],
    tokenCount: number,
    sourceUserMessageId?: string
  ): Promise<ConfirmationCard> {
    const pendingData = sourceUserMessageId
      ? { ...data, sourceUserMessageId }
      : data;

    const assistantMsg = await prisma.chatMessage.create({
      data: {
        userId,
        role: 'ASSISTANT',
        content: message,
        intent,
        tokenCount,
      },
    });

    const pending = await prisma.pendingConfirmation.create({
      data: {
        userId,
        chatMessageId: assistantMsg.id,
        type,
        data: JSON.stringify(pendingData),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.fsm.transition(userId, 'INTENT_PARSED', { pendingConfirmationId: pending.id });

    return {
      id: pending.id,
      type,
      data: pendingData,
      status: 'PENDING',
    };
  }

  private async normalizeBulkTransactions(
    userId: string,
    parsed: BulkTransactionParseResult
  ): Promise<TransactionEntities[]> {
    const normalizedTransactions: TransactionEntities[] = [];
    for (const item of parsed.items) {
      const normalizedDescription = this.normalizeTransactionDescription(item.description, item.type);
      const txEntities: TransactionEntities = {
        amount: item.amount,
        description: normalizedDescription,
        category: null,
        type: item.type,
        date: null,
      };
      const inferredCategory = await this.inferCategory(userId, txEntities);
      const resolvedCategory = item.categoryHint && this.isGenericCategory(inferredCategory) ? item.categoryHint : inferredCategory;
      txEntities.category =
        this.normalizeCategoryLabel(resolvedCategory, item.type, normalizedDescription) ||
        (item.type === 'income' ? 'Other Income' : 'Miscellaneous');
      normalizedTransactions.push(txEntities);
    }

    return normalizedTransactions;
  }

  private async saveBulkTransactions(userId: string, transactions: TransactionEntities[]): Promise<void> {
    // Insert in reverse so default "createdAt desc" listing appears in the same order
    // as the user typed in chat.
    const transactionsForInsert = [...transactions].reverse();

    await prisma.$transaction(async (tx) => {
      for (const txItem of transactionsForInsert) {
        await tx.transaction.create({
          data: {
            userId,
            amount: txItem.amount,
            description: txItem.description,
            category: txItem.category || 'Uncategorized',
            type: txItem.type === 'income' ? 'INCOME' : 'EXPENSE',
            source: 'chat',
            date: txItem.date ? new Date(txItem.date) : new Date(),
          },
        });
      }
    });

    for (const txItem of transactions) {
      await this.learnCategoryMapping(userId, txItem.description, txItem.category || 'Miscellaneous');
    }
  }

  private buildBulkLogSuccessMessage(
    transactions: TransactionEntities[],
    skippedLines: string[]
  ): string {
    const expenseTransactions = transactions.filter((item) => item.type === 'expense');
    const incomeTransactions = transactions.filter((item) => item.type === 'income');

    const expenseTotal = expenseTransactions.reduce((sum, item) => sum + item.amount, 0);
    const incomeTotal = incomeTransactions.reduce((sum, item) => sum + item.amount, 0);

    let summary: string;
    if (expenseTransactions.length > 0 && incomeTransactions.length === 0) {
      summary = `Logged ${expenseTransactions.length} expense item(s), total ₹${expenseTotal.toLocaleString('en-IN')}.`;
    } else if (incomeTransactions.length > 0 && expenseTransactions.length === 0) {
      summary = `Logged ${incomeTransactions.length} income item(s), total ₹${incomeTotal.toLocaleString('en-IN')}.`;
    } else {
      summary = `Logged ${transactions.length} transaction(s): income ₹${incomeTotal.toLocaleString('en-IN')}, expense ₹${expenseTotal.toLocaleString('en-IN')}.`;
    }

    const orderedPreview = transactions
      .slice(0, 10)
      .map((item, index) => `${index + 1}. ${item.description} ₹${item.amount.toLocaleString('en-IN')} (${item.category || 'Uncategorized'})`)
      .join(', ');
    const previewSuffix = transactions.length > 10 ? ` +${transactions.length - 10} more` : '';

    const skippedMessage =
      skippedLines.length > 0
        ? ` Skipped ${skippedLines.length} line(s): ${skippedLines.slice(0, 2).map((line) => `"${line}"`).join(', ')}.`
        : '';

    return `${summary} Added in order: ${orderedPreview}${previewSuffix}.${skippedMessage}`.trim();
  }

  private tryParseBulkTransactionList(content: string): BulkTransactionParseResult | null {
    const raw = (content || '').trim();
    if (!raw) return null;

    const hasLineBreaks = /\r?\n/.test(raw);
    const parts = (hasLineBreaks ? raw.split(/\r?\n/) : raw.split(/[;,]+/))
      .map((line) =>
        line
          .replace(/^\s*[\-\*\u2022]+\s*/, '')
          // Strip only true numbered-list prefixes like "1. " or "2) ".
          // Do not strip values like "500 coffee".
          .replace(/^\s*\d{1,2}[.)]\s+/, '')
          .trim()
      )
      .filter(Boolean);

    if (parts.length < 2) {
      return this.tryParseSingleLineAmountFirstBulk(raw);
    }

    const items: BulkTransactionItem[] = [];
    const skippedLines: string[] = [];
    let defaultType: 'income' | 'expense' = 'expense';
    let defaultCategoryHint: string | null = null;

    for (const line of parts) {
      const headerContext = this.detectBulkHeaderContext(line);
      if (headerContext) {
        defaultType = headerContext.type;
        defaultCategoryHint = headerContext.categoryHint;
        continue;
      }

      const parsed = this.parseBulkTransactionLine(line, defaultType, defaultCategoryHint);
      if (parsed) {
        items.push(parsed);
      } else {
        skippedLines.push(line);
      }
    }

    if (items.length < 2) return null;
    return { items, skippedLines };
  }

  private tryParseSingleLineAmountFirstBulk(raw: string): BulkTransactionParseResult | null {
    const normalized = raw.replace(/\s+/g, ' ').trim();
    const amountFirstPattern =
      /(?:^|\s)((?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\s+(.+?)(?=\s+(?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?\s+|$)/gi;

    const items: BulkTransactionItem[] = [];
    const skippedLines: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = amountFirstPattern.exec(normalized)) !== null) {
      const parsed = this.parseBulkTransactionLine(`${match[1]} ${match[2]}`, 'expense', null);
      if (parsed) {
        items.push(parsed);
      } else {
        skippedLines.push(`${match[1]} ${match[2]}`.trim());
      }
    }

    if (items.length < 2) return null;
    return { items, skippedLines };
  }

  private detectBulkHeaderContext(line: string): BulkHeaderContext | null {
    const normalized = line.toLowerCase().replace(/[:\-]/g, '').trim();
    if (/^(income|incomes|earning|earnings|salary list)$/.test(normalized)) {
      return { type: 'income', categoryHint: null };
    }
    if (/^(expense|expenses|spending|expense list)$/.test(normalized)) {
      return { type: 'expense', categoryHint: null };
    }
    if (/^(investment|investments|sip|mutual fund|stocks?)$/.test(normalized)) {
      return { type: 'expense', categoryHint: 'Investment' };
    }
    if (/^(returns|investment returns|dividends|interest income)$/.test(normalized)) {
      return { type: 'income', categoryHint: 'Investment' };
    }
    if (/^(savings|saving)$/.test(normalized)) {
      return { type: 'expense', categoryHint: 'Savings' };
    }
    return null;
  }

  private parseBulkTransactionLine(
    line: string,
    defaultType: 'income' | 'expense',
    defaultCategoryHint: string | null
  ): BulkTransactionItem | null {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;

    const explicitType = this.detectTypeFromLine(normalized);
    const type = explicitType || defaultType;

    const patterns: RegExp[] = [
      /^(.+?)\s*[:\-]\s*(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)$/i,
      /^(.+?)\s+(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)$/i,
      /^(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d{1,2})?(?:\s*(?:k|lakh|lac))?)\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (!match) continue;

      const isAmountFirst = pattern === patterns[2];
      const rawAmount = isAmountFirst ? match[1] : match[2];
      const rawDescription = isAmountFirst ? match[2] : match[1];
      const amount = this.parseFlexibleAmount(rawAmount);

      if (amount <= 0) return null;

      const description = rawDescription
        .replace(/^(spent|paid|bought|got|received|earned|credited)\s+/i, '')
        .replace(/\b(on|for|at)\b$/i, '')
        .trim();

      if (!description) return null;

      return {
        amount,
        description,
        type,
        categoryHint: defaultCategoryHint,
      };
    }

    return null;
  }

  private detectTypeFromLine(line: string): 'income' | 'expense' | null {
    const lower = line.toLowerCase();
    if (/\b(salary|salay|sallary|income|received|earned|credited|bonus|freelance|interest|dividend|refund|cashback|reimbursement|capital gain|profit booking|investment return)\b/.test(lower)) {
      return 'income';
    }
    if (/\b(spent|paid|bought|expense|expenses|bill|purchase|sip|mutual fund|etf|ppf|nps|insurance|premium|emi|loan|investment)\b/.test(lower)) {
      return 'expense';
    }
    return null;
  }

  private parseFlexibleAmount(rawAmount: string): number {
    if (!rawAmount) return 0;

    let normalized = rawAmount
      .toLowerCase()
      .replace(/₹|inr|rs\.?/g, '')
      .replace(/,/g, '')
      .trim();

    let multiplier = 1;
    if (normalized.endsWith('k')) {
      multiplier = 1000;
      normalized = normalized.slice(0, -1).trim();
    } else if (normalized.endsWith('lakh')) {
      multiplier = 100000;
      normalized = normalized.slice(0, -4).trim();
    } else if (normalized.endsWith('lac')) {
      multiplier = 100000;
      normalized = normalized.slice(0, -3).trim();
    }

    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed * multiplier;
  }
}
