import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { mvpService } from './mvpService';

export class MvpController {
  async handleChat(req: AuthenticatedRequest, res: Response<ApiResponse>): Promise<void> {
    try {
      const rawMessage = req.body?.message;

      if (typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'message is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await mvpService.handleMessage(userId, rawMessage);

      res.json({
        success: true,
        message: 'MVP chat processed',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof (error as { statusCode?: number }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : 500;

      const message =
        error instanceof Error ? error.message : 'Failed to process MVP chat request';

      res.status(statusCode).json({
        success: false,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const mvpController = new MvpController();
