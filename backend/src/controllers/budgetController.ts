import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ApiResponse, PaginatedApiResponse } from '../types';
import { normalizeCategory } from '../domain/categoryRegistry';
import {
  projectBudgets,
  summarizeBudgetProjections,
  type BudgetProjection,
} from '../services/budgetProjectionService';

type AuthenticatedRequest = Request & { user: { id: string } };
const getUserId = (req: Request) => (req as AuthenticatedRequest).user.id;

function sendBudgetError(res: Response<ApiResponse>, error: unknown, message: string): void {
  const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  res.status(duplicate ? 409 : 500).json({
    success: false,
    message: duplicate ? 'An active budget already exists for this category and period' : message,
    error: error instanceof Error ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
}

export class BudgetController {
  async getBudgets(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = getUserId(req);
      const { page = 1, limit = 10, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);
      const where: Prisma.BudgetWhereInput = { userId };
      if (typeof status === 'string') where.isActive = status === 'active';

      const [budgets, total] = await Promise.all([
        prisma.budget.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
        prisma.budget.count({ where }),
      ]);
      const data = await projectBudgets(userId, budgets);

      res.json({
        success: true,
        message: 'Budgets retrieved successfully',
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
        timestamp: new Date().toISOString(),
      } as PaginatedApiResponse<BudgetProjection>);
    } catch (error: unknown) {
      sendBudgetError(res, error, 'Failed to retrieve budgets');
    }
  }

  async getBudgetById(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = getUserId(req);
      const budget = await prisma.budget.findFirst({ where: { id: req.params.id, userId } });
      if (!budget) {
        res.status(404).json({
          success: false,
          message: 'Budget not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [data] = await projectBudgets(userId, [budget]);
      res.json({
        success: true,
        message: 'Budget retrieved successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      sendBudgetError(res, error, 'Failed to retrieve budget');
    }
  }

  async createBudget(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = getUserId(req);
      const { name, amount, period, isActive = true } = req.body;
      const budget = await prisma.budget.create({
        data: {
          name,
          categoryKey: normalizeCategory(name, 'expense')?.key || null,
          amount,
          period,
          isActive,
          userId,
        },
      });
      const [data] = await projectBudgets(userId, [budget]);

      res.status(201).json({
        success: true,
        message: 'Budget created successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      sendBudgetError(res, error, 'Failed to create budget');
    }
  }

  async updateBudget(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = getUserId(req);
      const existing = await prisma.budget.findFirst({ where: { id: req.params.id, userId } });
      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'Budget not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { name, amount, period, isActive } = req.body;
      const budget = await prisma.budget.update({
        where: { id: existing.id },
        data: {
          ...(name !== undefined && { name }),
          ...(amount !== undefined && { amount }),
          ...(period !== undefined && { period }),
          ...(isActive !== undefined && { isActive }),
          categoryKey: normalizeCategory(name ?? existing.name, 'expense')?.key || null,
        },
      });
      const [data] = await projectBudgets(userId, [budget]);

      res.json({
        success: true,
        message: 'Budget updated successfully',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      sendBudgetError(res, error, 'Failed to update budget');
    }
  }

  async deleteBudget(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = getUserId(req);
      const existing = await prisma.budget.findFirst({ where: { id: req.params.id, userId } });
      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'Budget not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.budget.delete({ where: { id: existing.id } });
      res.json({
        success: true,
        message: 'Budget deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      sendBudgetError(res, error, 'Failed to delete budget');
    }
  }

  async getBudgetAnalytics(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = getUserId(req);
      const days = Number(req.query.period || 30);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const [budgets, recentTransactions] = await Promise.all([
        prisma.budget.findMany({ where: { userId, isActive: true } }),
        prisma.transaction.findMany({
          where: { userId, type: 'EXPENSE', date: { gte: startDate } },
          orderBy: { date: 'desc' },
          take: 10,
        }),
      ]);
      const projectedBudgets = await projectBudgets(userId, budgets);
      const summary = summarizeBudgetProjections(projectedBudgets);

      res.json({
        success: true,
        message: 'Budget analytics retrieved successfully',
        data: {
          ...summary,
          budgetCount: projectedBudgets.length,
          activeBudgets: projectedBudgets.length,
          recentTransactions,
          budgets: projectedBudgets,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      sendBudgetError(res, error, 'Failed to retrieve budget analytics');
    }
  }
}
