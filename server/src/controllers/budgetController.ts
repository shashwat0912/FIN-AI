import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse, PaginatedApiResponse } from '../types';
import { Budget } from '@prisma/client';

const prisma = new PrismaClient();

export class BudgetController {
  // Get all budgets for a user
  async getBudgets(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { page = 1, limit = 10, status } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = { userId };
      if (status) {
        where.isActive = status === 'active';
      }

      const [budgets, total] = await Promise.all([
        prisma.budget.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.budget.count({ where }),
      ]);

      res.json({
        success: true,
        message: 'Budgets retrieved successfully',
        data: budgets,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
        timestamp: new Date().toISOString(),
      } as PaginatedApiResponse<Budget>);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve budgets',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
      return;
    }
  }

  // Get budget by ID
  async getBudgetById(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const budget = await prisma.budget.findFirst({
        where: { id, userId },
      });
      return;

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      res.json({
        success: true,
        message: 'Budget retrieved successfully',
        data: budget,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve budget',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Create new budget
  async createBudget(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { name, amount, spent = 0, period, isActive = true } = req.body;

      const budget = await prisma.budget.create({
        data: {
          name,
          amount,
          spent,
          period,
          isActive,
          userId,
        },
      });
      return;

      res.status(201).json({
        success: true,
        message: 'Budget created successfully',
        data: budget,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create budget',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Update budget
  async updateBudget(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updateData = req.body;

      // Check if budget exists and belongs to user
      const existingBudget = await prisma.budget.findFirst({
        where: { id, userId },
      });
      return;

      if (!existingBudget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      const budget = await prisma.budget.update({
        where: { id },
        data: updateData,
      });
      return;

      res.json({
        success: true,
        message: 'Budget updated successfully',
        data: budget,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update budget',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Delete budget
  async deleteBudget(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Check if budget exists and belongs to user
      const existingBudget = await prisma.budget.findFirst({
        where: { id, userId },
      });
      return;

      if (!existingBudget) {
        return res.status(404).json({
          success: false,
          message: 'Budget not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      await prisma.budget.delete({
        where: { id },
      });
      return;

      res.json({
        success: true,
        message: 'Budget deleted successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete budget',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Get budget analytics
  async getBudgetAnalytics(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { period = '30' } = req.query;

      const days = Number(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const budgets = await prisma.budget.findMany({
        where: { userId, isActive: true },
      });
      return;

      // Calculate analytics
      const totalBudget = budgets.reduce((sum, budget) => sum + Number(budget.amount), 0);
      const totalSpent = budgets.reduce((sum, budget) => sum + Number(budget.spent), 0);
      const remainingBudget = totalBudget - totalSpent;
      const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      // Get recent transactions for spending analysis
      const recentTransactions = await prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: startDate },
          type: 'EXPENSE',
        },
        orderBy: { date: 'desc' },
      });
      return;

      const analytics = {
        totalBudget,
        totalSpent,
        remainingBudget,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        budgetCount: budgets.length,
        activeBudgets: budgets.filter(b => b.isActive).length,
        recentTransactions: recentTransactions.slice(0, 10),
        budgets: budgets.map(budget => ({
          ...budget,
          utilizationRate: Number(budget.amount) > 0 
            ? Math.round((Number(budget.spent) / Number(budget.amount)) * 10000) / 100 
            : 0,
          remaining: Number(budget.amount) - Number(budget.spent),
        })),
      };

      res.json({
        success: true,
        message: 'Budget analytics retrieved successfully',
        data: analytics,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve budget analytics',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}


