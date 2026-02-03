import { Request, Response } from 'express';
import { AiService } from '../services/aiService';
import { ApiResponse } from '../types';
import logger from '../config/logger';

const aiService = new AiService();

export class AiController {
  async getAdvice(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const result = await aiService.getFinancialAdvice(userId, req.body);
      
      res.json({
        success: true,
        message: 'AI advice generated successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('AI advice error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate AI advice',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async getHistory(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await aiService.getAiHistory(userId, limit);
      
      res.json({
        success: true,
        message: 'AI history retrieved successfully',
        data: history,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Get AI history error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get AI history',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  async deleteSession(req: Request, res: Response<ApiResponse>) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;
      const result = await aiService.deleteAiSession(userId, id);
      
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (error: any) {
      logger.error('Delete AI session error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete AI session',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }
}
