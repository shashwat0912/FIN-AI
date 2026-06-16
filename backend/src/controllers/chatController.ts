import { Response } from 'express';
import { ChatService } from '../services/chat/chatService';
import { AuthenticatedRequest, ApiResponse } from '../types';
import logger from '../config/logger';

const chatService = new ChatService();

export class ChatController {
  async postMessage(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const userId = req.user!.id;
      const content = req.body?.content != null ? String(req.body.content).trim() : '';

      const result = await chatService.processMessage(userId, content);

      res.json({
        success: true,
        message: 'Message processed',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Chat postMessage error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to process message',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async confirmAction(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const userId = req.user!.id;
      const { confirmationId } = req.body;

      const result = await chatService.confirmAction(userId, confirmationId);

      res.json({
        success: true,
        message: 'Action confirmed',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Chat confirmAction error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to confirm action',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async editAction(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const userId = req.user!.id;
      const { confirmationId, data } = req.body;

      const result = await chatService.editAction(userId, confirmationId, data);

      res.json({
        success: true,
        message: 'Action edited',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Chat editAction error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to edit action',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await chatService.getHistory(userId, limit, offset);

      res.json({
        success: true,
        message: 'Chat history retrieved',
        data: messages,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Chat getHistory error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve chat history',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
