import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse, PaginatedApiResponse } from '../types';
import { Goal } from '@prisma/client';

const prisma = new PrismaClient();

export class GoalController {
  // Get all goals for a user
  async getGoals(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { page = 1, limit = 10, status } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      const [goals, total] = await Promise.all([
        prisma.goal.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.goal.count({ where }),
      ]);

      res.json({
        success: true,
        message: 'Goals retrieved successfully',
        data: goals,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
        timestamp: new Date().toISOString(),
      } as PaginatedApiResponse<Goal>);
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve goals',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Get goal by ID
  async getGoalById(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const goal = await prisma.goal.findFirst({
        where: { id, userId },
      });
      return;

      if (!goal) {
        return res.status(404).json({
          success: false,
          message: 'Goal not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      res.json({
        success: true,
        message: 'Goal retrieved successfully',
        data: goal,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve goal',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Create new goal
  async createGoal(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { name, description, targetAmount, currentAmount = 0, targetDate, status = 'ACTIVE' } = req.body;

      const goal = await prisma.goal.create({
        data: {
          name,
          description,
          targetAmount,
          currentAmount,
          targetDate: targetDate ? new Date(targetDate) : null,
          status,
          userId,
        },
      });
      return;

      res.status(201).json({
        success: true,
        message: 'Goal created successfully',
        data: goal,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create goal',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Update goal
  async updateGoal(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const updateData = req.body;

      // Check if goal exists and belongs to user
      const existingGoal = await prisma.goal.findFirst({
        where: { id, userId },
      });
      return;

      if (!existingGoal) {
        return res.status(404).json({
          success: false,
          message: 'Goal not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      // Handle targetDate conversion
      if (updateData.targetDate) {
        updateData.targetDate = new Date(updateData.targetDate);
      }

      const goal = await prisma.goal.update({
        where: { id },
        data: updateData,
      });
      return;

      res.json({
        success: true,
        message: 'Goal updated successfully',
        data: goal,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update goal',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Delete goal
  async deleteGoal(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      // Check if goal exists and belongs to user
      const existingGoal = await prisma.goal.findFirst({
        where: { id, userId },
      });
      return;

      if (!existingGoal) {
        return res.status(404).json({
          success: false,
          message: 'Goal not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      await prisma.goal.delete({
        where: { id },
      });
      return;

      res.json({
        success: true,
        message: 'Goal deleted successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete goal',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Get goal analytics
  async getGoalAnalytics(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;

      const goals = await prisma.goal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return;

      // Calculate analytics
      const totalGoals = goals.length;
      const activeGoals = goals.filter(g => g.status === 'ACTIVE').length;
      const completedGoals = goals.filter(g => g.status === 'COMPLETED').length;
      const pausedGoals = goals.filter(g => g.status === 'PAUSED').length;
      const cancelledGoals = goals.filter(g => g.status === 'CANCELLED').length;

      const totalTargetAmount = goals.reduce((sum, goal) => sum + Number(goal.targetAmount), 0);
      const totalCurrentAmount = goals.reduce((sum, goal) => sum + Number(goal.currentAmount), 0);
      const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

      // Goals nearing completion (80%+ progress)
      const nearingCompletion = goals.filter(goal => {
        const progress = Number(goal.targetAmount) > 0 
          ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 
          : 0;
        return progress >= 80 && goal.status === 'ACTIVE';
      });
      return;

      // Goals with upcoming deadlines (within 30 days)
      const upcomingDeadlines = goals.filter(goal => {
        if (!goal.targetDate || goal.status !== 'ACTIVE') return false;
        const daysUntilDeadline = Math.ceil(
          (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilDeadline <= 30 && daysUntilDeadline > 0;
      });
      return;

      const analytics = {
        totalGoals,
        activeGoals,
        completedGoals,
        pausedGoals,
        cancelledGoals,
        totalTargetAmount,
        totalCurrentAmount,
        overallProgress: Math.round(overallProgress * 100) / 100,
        nearingCompletion: nearingCompletion.length,
        upcomingDeadlines: upcomingDeadlines.length,
        goals: goals.map(goal => {
          const progress = Number(goal.targetAmount) > 0 
            ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 
            : 0;
          const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
          const daysUntilDeadline = goal.targetDate 
            ? Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return {
            ...goal,
            progress: Math.round(progress * 100) / 100,
            remaining,
            daysUntilDeadline,
            isOverdue: daysUntilDeadline !== null && daysUntilDeadline < 0 && goal.status === 'ACTIVE',
          };
        }),
      };

      res.json({
        success: true,
        message: 'Goal analytics retrieved successfully',
        data: analytics,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve goal analytics',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}


