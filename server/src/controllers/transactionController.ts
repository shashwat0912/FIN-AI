import { Request, Response } from 'express';
import { TransactionService } from '../services/transactionService';
import { ApiResponse, PaginationParams } from '../types';
import logger from '../config/logger';

const transactionService = new TransactionService();

export class TransactionController {
  async createTransaction(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const transaction = await transactionService.createTransaction(userId, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: transaction,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Create transaction error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create transaction',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async getTransactions(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await transactionService.getTransactions(userId, pagination);
      res.json(result);
    } catch (error: any) {
      logger.error('Get transactions error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get transactions',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async getTransactionById(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const transaction = await transactionService.getTransactionById(userId, id);
      
      res.json({
        success: true,
        message: 'Transaction retrieved successfully',
        data: transaction,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Get transaction error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get transaction',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async updateTransaction(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const transaction = await transactionService.updateTransaction(userId, id, req.body);
      
      res.json({
        success: true,
        message: 'Transaction updated successfully',
        data: transaction,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Update transaction error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update transaction',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async deleteTransaction(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const result = await transactionService.deleteTransaction(userId, id);
      
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Delete transaction error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete transaction',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async getTransactionAnalytics(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const period = req.query.period as string || '30';
      const analytics = await transactionService.getTransactionAnalytics(userId, period);
      
      res.json({
        success: true,
        message: 'Transaction analytics retrieved successfully',
        data: analytics,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Get analytics error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get analytics',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async getCategories(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const categories = await transactionService.getCategories(userId);
      
      res.json({
        success: true,
        message: 'Categories retrieved successfully',
        data: categories,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Get categories error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get categories',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async searchTransactions(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || query.trim().length === 0) {
        return res.json({
          success: true,
          message: 'Search query is required',
          data: [],
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await transactionService.searchTransactions(userId, query, limit);
      res.json(result);
      return;
    } catch (error: any) {
      logger.error('Search transactions error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to search transactions',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}
