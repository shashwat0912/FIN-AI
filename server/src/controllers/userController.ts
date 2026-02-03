import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../types';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export class UserController {
  // Get user profile
  async getProfile(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Update user profile
  async updateProfile(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { name, email } = req.body;

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await prisma.user.findFirst({
          where: { email, id: { not: userId } },
        });
      return;

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken',
            timestamp: new Date().toISOString(),
          });
      return;
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { name, email },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return;

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Upload avatar
  async uploadAvatar(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { avatarUrl } = req.body;

      if (!avatarUrl) {
        return res.status(400).json({
          success: false,
          message: 'Avatar URL is required',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatar: avatarUrl },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return;

      res.json({
        success: true,
        message: 'Avatar updated successfully',
        data: user,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update avatar',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Delete avatar
  async deleteAvatar(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatar: null },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return;

      res.json({
        success: true,
        message: 'Avatar deleted successfully',
        data: user,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete avatar',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Change password
  async changePassword(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!user || !user.password) {
        return res.status(400).json({
          success: false,
          message: 'Password not set for this account',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString(),
        });
      return;
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
      return;

      res.json({
        success: true,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Get user statistics
  async getUserStats(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;

      const [transactionCount, budgetCount, goalCount, aiSessionCount] = await Promise.all([
        prisma.transaction.count({ where: { userId } }),
        prisma.budget.count({ where: { userId } }),
        prisma.goal.count({ where: { userId } }),
        prisma.aiSession.count({ where: { userId } }),
      ]);

      // Get recent activity
      const recentTransactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          description: true,
          type: true,
          createdAt: true,
        },
      });
      return;

      const stats = {
        transactionCount,
        budgetCount,
        goalCount,
        aiSessionCount,
        recentTransactions,
      };

      res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user statistics',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}


