import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AiAdviceRequest } from '../types';
import prisma from '../config/database';
import logger from '../config/logger';
import OpenAI from 'openai';
import { RAGService, RetrievedChunk } from './ragService';
import { hasUsableOpenAiKey } from '../config/openai';
import { projectBudgets, summarizeBudgetProjections } from './budgetProjectionService';

type FinancialContext = Record<string, unknown> & {
  currentBalance?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  goals?: string[];
  totalDebt?: number;
  savingsRate?: number;
  budgetUtilization?: number;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown';

export class AiService {
  private openai: OpenAI | null = null;
  private ragService: RAGService;

  constructor() {
    // Initialize OpenAI only when provider allows it and API key looks real.
    const aiProvider = (config.AI_PROVIDER || 'auto').toLowerCase();
    const openAiAllowed = aiProvider === 'openai' || aiProvider === 'auto';
    const hasOpenAiKey = hasUsableOpenAiKey(config.OPENAI_API_KEY);

    if (openAiAllowed && hasOpenAiKey) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
        timeout: config.OPENAI_TIMEOUT_MS,
      });
    }
    
    // Initialize RAG service
    this.ragService = new RAGService();
  }

  async getFinancialAdvice(userId: string, data: AiAdviceRequest) {
    const { query, context } = data;

    try {
      let advice: string;
      let retrievedChunks: RetrievedChunk[] = [];
      let enhancedContext: FinancialContext = {};

      try {
        retrievedChunks = await this.ragService.retrieveContext(query, {
          topK: 4,
          similarityThreshold: 0.25,
          candidatePool: 250,
          jurisdiction: 'india',
        });
      } catch (ragError: unknown) {
        logger.warn('RAG retrieval failed, continuing without retrieved chunks', {
          error: errorMessage(ragError),
        });
      }

      enhancedContext = await this.getUserFinancialContext(userId, context);

      // Use OpenAI with RAG if available, otherwise use deterministic grounded advice.
      if (this.openai) {
        try {
          // Generate grounded prompt with RAG context.
          const prompt = this.ragService.buildGroundedAdvicePrompt(
            query,
            enhancedContext,
            retrievedChunks
          );
          
          const completion = await this.openai.chat.completions.create({
            model: config.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert Indian financial advisor. Ground every recommendation in provided context. Do not promise guaranteed returns. If context is insufficient, ask one focused follow-up question.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: config.OPENAI_MAX_TOKENS || 500,
            temperature: 0.4,
          });

          advice = completion.choices[0]?.message?.content || this.generateMockAdvice(query);
          advice = this.postProcessAdvice(advice);
          
          logger.info('RAG-enhanced advice generated', {
            retrievedChunks: retrievedChunks.length,
            topSimilarity: retrievedChunks[0]?.similarity || 0,
          });
        } catch (openaiError: unknown) {
          logger.warn('OpenAI advice generation failed. Falling back to deterministic grounded advice.', {
            error: errorMessage(openaiError),
          });
          advice = this.generateGroundedLocalAdvice(query, enhancedContext, retrievedChunks);
        }
      } else {
        logger.info('OpenAI disabled or unavailable, using deterministic grounded advisor');
        advice = this.generateGroundedLocalAdvice(query, enhancedContext, retrievedChunks);
      }

      // Store the AI session
      const aiSession = await prisma.aiSession.create({
        data: {
          query,
          response: advice,
          category: this.categorizeQuery(query),
          userId,
        },
      });

      logger.info('AI advice generated', { event: 'ai_advice_generated', outcome: 'success' });

      return {
        advice,
        category: aiSession.category,
        sessionId: aiSession.id,
      };
    } catch (error) {
      logger.error('AI service error:', error);
      throw new AppError('Failed to generate AI advice', 500);
    }
  }

  async getAiHistory(userId: string, limit: number = 10) {
    const sessions = await prisma.aiSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        query: true,
        response: true,
        category: true,
        createdAt: true,
      },
    });

    return sessions;
  }

  async deleteAiSession(userId: string, sessionId: string) {
    const session = await prisma.aiSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new AppError('AI session not found', 404);
    }

    await prisma.aiSession.delete({
      where: { id: sessionId },
    });

    logger.info('AI session deleted', { event: 'ai_session_deleted', outcome: 'success' });

    return { success: true, message: 'AI session deleted successfully' };
  }

  private generateMockAdvice(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('budget') || lowerQuery.includes('spending')) {
      return `Based on your query about budgeting, I recommend creating a 50/30/20 budget: 50% for needs, 30% for wants, and 20% for savings. Track your expenses daily and review your budget weekly to stay on track.`;
    }

    if (lowerQuery.includes('investment') || lowerQuery.includes('invest')) {
      return `For investments, consider starting with low-cost index funds or ETFs. Diversify across different asset classes and maintain a long-term perspective. Remember, past performance doesn't guarantee future results.`;
    }

    if (lowerQuery.includes('debt') || lowerQuery.includes('loan')) {
      return `To manage debt effectively, prioritize high-interest debts first (debt avalanche method) or smallest debts first (debt snowball method). Consider debt consolidation if it reduces your overall interest rate.`;
    }

    if (lowerQuery.includes('saving') || lowerQuery.includes('emergency')) {
      return `Build an emergency fund covering 3-6 months of expenses. Start small and automate your savings. Consider high-yield savings accounts or money market accounts for better returns.`;
    }

    if (lowerQuery.includes('retirement') || lowerQuery.includes('pension')) {
      return `For retirement planning, take advantage of employer matching in 401(k) plans, consider Roth IRAs for tax-free growth, and aim to save 15-20% of your income. Start early to benefit from compound interest.`;
    }

    // Default response
    return `I understand you're asking about "${query}". For personalized financial advice, I'd need more specific information about your financial situation, goals, and risk tolerance. Consider consulting with a certified financial planner for comprehensive guidance.`;
  }

  private categorizeQuery(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('budget') || lowerQuery.includes('spending')) {
      return 'budgeting';
    }
    if (lowerQuery.includes('investment') || lowerQuery.includes('invest')) {
      return 'investment';
    }
    if (lowerQuery.includes('debt') || lowerQuery.includes('loan')) {
      return 'debt_management';
    }
    if (lowerQuery.includes('saving') || lowerQuery.includes('emergency')) {
      return 'savings';
    }
    if (lowerQuery.includes('retirement') || lowerQuery.includes('pension')) {
      return 'retirement';
    }

    return 'general';
  }

  private generatePrompt(query: string, context?: FinancialContext): string {
    let prompt = `User query: ${query}\n\n`;
    
    if (context) {
      prompt += `Financial context:\n`;
      if (context.currentBalance !== undefined) {
        prompt += `- Current Balance: ₹${context.currentBalance}\n`;
      }
      if (context.monthlyIncome !== undefined) {
        prompt += `- Monthly Income: ₹${context.monthlyIncome}\n`;
      }
      if (context.monthlyExpenses !== undefined) {
        prompt += `- Monthly Expenses: ₹${context.monthlyExpenses}\n`;
      }
      if (context.goals && context.goals.length > 0) {
        prompt += `- Goals: ${context.goals.join(', ')}\n`;
      }
    }
    
    prompt += `\nPlease provide concise, actionable financial advice based on Indian financial markets and regulations.`;
    
    return prompt;
  }

  private postProcessAdvice(rawAdvice: string): string {
    let advice = rawAdvice.replace(/\s+/g, ' ').trim();

    // Guardrail: avoid over-confident guarantee phrasing.
    const bannedClaims = [/guaranteed returns?/gi, /risk[- ]?free returns?/gi, /sure[- ]?shot/gi];
    for (const pattern of bannedClaims) {
      advice = advice.replace(pattern, 'potential returns');
    }

    // Keep output concise for chat UI.
    if (advice.length > 320) {
      advice = `${advice.slice(0, 317).trimEnd()}...`;
    }

    return advice;
  }

  private generateGroundedLocalAdvice(
    query: string,
    userContext: FinancialContext,
    retrievedChunks: RetrievedChunk[]
  ): string {
    const actions: string[] = [];

    const monthlyIncome = Number(userContext?.monthlyIncome || 0);
    const monthlyExpenses = Number(userContext?.monthlyExpenses || 0);
    const savingsRate = Number(userContext?.savingsRate || 0);
    const budgetUtilization = Number(userContext?.budgetUtilization || 0);

    if (monthlyIncome > 0) {
      const targetSavings = Math.max(Math.round(monthlyIncome * 0.2), 1000);
      const currentSavings = Math.max(monthlyIncome - monthlyExpenses, 0);
      if (currentSavings < targetSavings) {
        const gap = targetSavings - currentSavings;
        actions.push(
          `Increase monthly savings by about ₹${gap.toLocaleString('en-IN')} to reach a 20% savings rate.`
        );
      }
    }

    if (budgetUtilization >= 90) {
      actions.push('You are near your budget limit; reduce discretionary spending categories by 10-15% this month.');
    }

    if (savingsRate > 0 && savingsRate < 15) {
      actions.push('Your savings rate is low. Auto-transfer savings on salary day before discretionary spending.');
    }

    if (retrievedChunks.length > 0) {
      const top = retrievedChunks[0];
      const distilled = this.distillChunkToAction(top.content);
      if (distilled) {
        actions.push(distilled);
      }
    }

    if (actions.length === 0) {
      actions.push(
        'Track essential vs discretionary expenses for 2 weeks, then set category caps for food, transport, and shopping.'
      );
      actions.push('Build an emergency fund target of at least 3 months of expenses.');
    }

    const source = retrievedChunks[0]?.source || retrievedChunks[0]?.documentTitle;
    const sourceLine = source ? ` Source: ${source}.` : '';

    const summary = `For "${query}", here is a practical plan:`;
    const plan = actions.slice(0, 3).map((action, idx) => `${idx + 1}) ${action}`).join(' ');

    return this.postProcessAdvice(`${summary} ${plan}${sourceLine}`);
  }

  private distillChunkToAction(content: string): string | null {
    const sentence = content
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .find((part) => part.length >= 40);

    if (!sentence) return null;

    return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}...` : sentence;
  }

  /**
   * Generate enhanced prompt with RAG context
   */
  private generateEnhancedPrompt(
    query: string,
    userContext: FinancialContext,
    retrievedChunks: RetrievedChunk[]
  ): string {
    let prompt = `User Query: ${query}\n\n`;

    // Add retrieved knowledge context
    if (retrievedChunks && retrievedChunks.length > 0) {
      prompt += `Relevant Financial Knowledge:\n`;
      retrievedChunks.forEach((chunk, index) => {
        prompt += `${index + 1}. ${chunk.content}\n`;
        if (chunk.source) {
          prompt += `   Source: ${chunk.source}\n`;
        }
      });
      prompt += `\n`;
    }

    // Add user's financial context
    if (userContext) {
      prompt += `User's Financial Profile:\n`;
      
      if (userContext.currentBalance !== undefined) {
        prompt += `- Current Balance: ₹${userContext.currentBalance.toLocaleString('en-IN')}\n`;
      }
      if (userContext.monthlyIncome !== undefined) {
        prompt += `- Monthly Income: ₹${userContext.monthlyIncome.toLocaleString('en-IN')}\n`;
      }
      if (userContext.monthlyExpenses !== undefined) {
        prompt += `- Monthly Expenses: ₹${userContext.monthlyExpenses.toLocaleString('en-IN')}\n`;
        const savings = Number(userContext.monthlyIncome) - userContext.monthlyExpenses;
        prompt += `- Monthly Savings: ₹${savings.toLocaleString('en-IN')}\n`;
      }
      if (userContext.goals && userContext.goals.length > 0) {
        prompt += `- Financial Goals: ${userContext.goals.join(', ')}\n`;
      }
      if (userContext.totalDebt !== undefined && userContext.totalDebt > 0) {
        prompt += `- Outstanding Debt: ₹${userContext.totalDebt.toLocaleString('en-IN')}\n`;
      }
      if (userContext.savingsRate !== undefined) {
        prompt += `- Savings Rate: ${userContext.savingsRate}%\n`;
      }
    }

    prompt += `\nInstruction: Based on the knowledge provided above and the user's financial profile, give specific, actionable advice. Reference Indian financial regulations, tax implications, and local investment options where relevant. Keep the response concise (under 200 characters) but ensure it's personalized and practical.`;

    return prompt;
  }

  /**
   * Get comprehensive financial context for a user
   */
  private async getUserFinancialContext(
    userId: string,
    providedContext?: AiAdviceRequest['context']
  ): Promise<FinancialContext> {
    try {
      // Start with provided context
      const context: FinancialContext = { ...providedContext };

      // Fetch user's transactions to calculate actual income/expenses
      const recentTransactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 100, // Last 100 transactions
      });

      // Calculate monthly income and expenses from actual transactions
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const recentTxns = recentTransactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
      
      const monthlyIncome = recentTxns
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const monthlyExpenses = recentTxns
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Calculate current balance
      const allIncome = recentTransactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const allExpenses = recentTransactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      context.currentBalance = context.currentBalance || (allIncome - allExpenses);
      context.monthlyIncome = context.monthlyIncome || monthlyIncome;
      context.monthlyExpenses = context.monthlyExpenses || monthlyExpenses;
      context.savingsRate = monthlyIncome > 0 
        ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100)
        : 0;

      // Fetch user's active goals
      const goals = await prisma.goal.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { name: true, targetAmount: true, currentAmount: true },
      });

      context.goals = goals.map(g => 
        `${g.name} (₹${Number(g.currentAmount).toLocaleString('en-IN')} / ₹${Number(g.targetAmount).toLocaleString('en-IN')})`
      );

      // Fetch user's active budgets
      const budgets = await prisma.budget.findMany({
        where: { userId, isActive: true },
      });
      const projectedBudgets = await projectBudgets(userId, budgets);
      const budgetSummary = summarizeBudgetProjections(projectedBudgets);
      context.budgetUtilization = budgetSummary.utilizationPercentage.toNumber();

      return context;
    } catch (error) {
      logger.error('Failed to get user financial context:', error);
      // Return provided context as fallback
      return providedContext || {};
    }
  }
}
