import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AiAdviceRequest } from '../types';
import prisma from '../config/database';
import logger from '../config/logger';
import OpenAI from 'openai';
import { RAGService } from './ragService';

export class AiService {
  private openai: OpenAI | null = null;
  private ragService: RAGService;

  constructor() {
    // Initialize OpenAI client if API key is available
    if (config.OPENAI_API_KEY && config.OPENAI_API_KEY !== '') {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
    
    // Initialize RAG service
    this.ragService = new RAGService();
  }

  async getFinancialAdvice(userId: string, data: AiAdviceRequest) {
    const { query, context } = data;

    try {
      let advice: string;

      // Use OpenAI with RAG if available, otherwise fall back to mock
      if (this.openai) {
        try {
          // Step 1: Retrieve relevant knowledge using RAG
          const retrievedChunks = await this.ragService.retrieveContext(query, {
            topK: 3,
            similarityThreshold: 0.7,
          });

          // Step 2: Fetch user's complete financial context
          const enhancedContext = await this.getUserFinancialContext(userId, context);

          // Step 3: Generate enhanced prompt with RAG context
          const prompt = this.generateEnhancedPrompt(query, enhancedContext, retrievedChunks);
          
          const completion = await this.openai.chat.completions.create({
            model: config.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are an expert Indian financial advisor with deep knowledge of RBI regulations, Indian tax laws, and local investment options. Provide concise, actionable advice tailored to Indian financial markets. Keep responses under 200 characters while being specific and practical.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: config.OPENAI_MAX_TOKENS || 500,
            temperature: 0.7,
          });

          advice = completion.choices[0]?.message?.content || this.generateMockAdvice(query, context);
          
          logger.info('RAG-enhanced advice generated', {
            userId,
            retrievedChunks: retrievedChunks.length,
            topSimilarity: retrievedChunks[0]?.similarity || 0,
          });
        } catch (openaiError: any) {
          logger.error('OpenAI API error:', openaiError);
          // Fall back to mock advice if OpenAI fails
          advice = this.generateMockAdvice(query, context);
        }
      } else {
        // No OpenAI API key, use mock response
        logger.warn('OpenAI API key not configured, using mock advice');
        advice = this.generateMockAdvice(query, context);
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

      logger.info(`AI advice generated for user: ${userId}, session: ${aiSession.id}`);

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

    logger.info(`AI session deleted: ${sessionId} for user: ${userId}`);

    return { success: true, message: 'AI session deleted successfully' };
  }

  private generateMockAdvice(query: string, context?: any): string {
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

  private generatePrompt(query: string, context?: any): string {
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

  /**
   * Generate enhanced prompt with RAG context
   */
  private generateEnhancedPrompt(query: string, userContext: any, retrievedChunks: any[]): string {
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
        const savings = userContext.monthlyIncome - userContext.monthlyExpenses;
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
  private async getUserFinancialContext(userId: string, providedContext?: any): Promise<any> {
    try {
      // Start with provided context
      const context: any = { ...providedContext };

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
        select: { name: true, amount: true, spent: true },
      });

      const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
      const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent), 0);
      
      context.budgetUtilization = totalBudget > 0 
        ? Math.round((totalSpent / totalBudget) * 100)
        : 0;

      return context;
    } catch (error) {
      logger.error('Failed to get user financial context:', error);
      // Return provided context as fallback
      return providedContext || {};
    }
  }
}
