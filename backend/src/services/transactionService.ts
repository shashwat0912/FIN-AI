import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { TransactionRequest, PaginationParams, PaginatedResponse } from '../types';
import logger from '../config/logger';

export class TransactionService {
  async createTransaction(userId: string, data: TransactionRequest) {
    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        userId,
        amount: data.amount,
        date: new Date(data.date),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Transaction created: ${transaction.id} for user: ${userId}`);

    return transaction;
  }

  async getTransactions(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.transaction.count({
        where: { userId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Transactions retrieved successfully',
      data: transactions,
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getTransactionById(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    return transaction;
  }

  async updateTransaction(userId: string, transactionId: string, data: Partial<TransactionRequest>) {
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!existingTransaction) {
      throw new AppError('Transaction not found', 404);
    }

    const updateData: any = { ...data };
    if (data.date) {
      updateData.date = new Date(data.date);
    }

    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Transaction updated: ${transactionId} for user: ${userId}`);

    return transaction;
  }

  async deleteTransaction(userId: string, transactionId: string) {
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!existingTransaction) {
      throw new AppError('Transaction not found', 404);
    }

    await prisma.transaction.delete({
      where: { id: transactionId },
    });

    logger.info(`Transaction deleted: ${transactionId} for user: ${userId}`);

    return { success: true, message: 'Transaction deleted successfully' };
  }

  async getTransactionAnalytics(userId: string, period: string = '30') {
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
    });

    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const categories = transactions.reduce((acc, t) => {
      if (t.type === 'EXPENSE') {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    return {
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      topCategories,
      transactionCount: transactions.length,
      period: `${days} days`,
    };
  }

  async getCategories(userId: string) {
    const categories = await prisma.transaction.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });

    return categories.map(c => c.category);
  }

  async searchTransactions(userId: string, query: string, limit: number = 10) {
    if (!query || query.trim().length === 0) {
      return {
        success: true,
        message: 'Search query is empty',
        data: [],
        timestamp: new Date().toISOString(),
      };
    }

    const searchTerm = query.trim();
    const searchTermLower = searchTerm.toLowerCase();

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          {
            description: {
              contains: searchTerm,
            },
          },
          {
            description: {
              contains: searchTermLower,
            },
          },
          {
            category: {
              contains: searchTerm,
            },
          },
          {
            category: {
              contains: searchTermLower,
            },
          },
          {
            type: {
              contains: searchTerm,
            },
          },
          {
            type: {
              contains: searchTermLower,
            },
          },
        ],
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Format results for search display
    const searchResults = transactions.map(transaction => ({
      id: transaction.id,
      type: 'transaction',
      title: transaction.description,
      amount: `₹${transaction.amount.toLocaleString()}`,
      category: transaction.category,
      transactionType: transaction.type,
      date: this.formatDate(transaction.date),
      icon: 'DollarSign',
      color: transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600',
    }));

    return {
      success: true,
      message: 'Search completed successfully',
      data: searchResults,
      timestamp: new Date().toISOString(),
    };
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    if (diffDays <= 30) return `${Math.floor((diffDays - 1) / 30)} months ago`;
    return date.toLocaleDateString();
  }
}
