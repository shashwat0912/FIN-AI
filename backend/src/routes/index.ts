import { Router } from 'express';
import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import authRoutes from './auth';
import transactionRoutes from './transactions';
import aiRoutes from './ai';
import budgetRoutes from './budgets';
import goalRoutes from './goals';
import userRoutes from './users';
import settingsRoutes from './settings';
import knowledgeRoutes from './knowledge';
import chatRoutes from './chat';
import mvpRoutes from './mvpRoutes';
import v1FinanceRoutes from './v1FinanceRoutes';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    message: 'Finance AI Backend is running',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
    timestamp: new Date().toISOString(),
  });
});

// Explicit CSRF bootstrap endpoint for SPAs.
router.get('/csrf-token', (req: Request, res: Response<ApiResponse>) => {
  res.json({
    success: true,
    message: 'CSRF token issued',
    data: {
      token: res.getHeader('X-CSRF-Token') || null,
    },
    timestamp: new Date().toISOString(),
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/ai', aiRoutes);
router.use('/budgets', budgetRoutes);
router.use('/goals', goalRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/chat', chatRoutes);
router.use('/mvp', mvpRoutes);
router.use('/', v1FinanceRoutes);

export default router;
