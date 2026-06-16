import { Router, Response, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse, AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { v1FinancialEngine } from '../services/v1FinancialEngine';
import { getInsight } from '../services/v1InsightService';
import logger from '../config/logger';

const router = Router();

router.use(authenticateToken);

/**
 * Simple V1 transaction insert — direct Prisma create, bypasses legacy transaction controller.
 * Spec: amount, type "income"|"expense", category, optional description, optional date (default now).
 */
const handleV1CreateTransaction: RequestHandler = async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.user!.id;
    const { amount, type, category, description, date } = req.body ?? {};

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'amount must be a positive number', timestamp: new Date().toISOString() });
      return;
    }
    const normType = String(type).toUpperCase();
    if (normType !== 'INCOME' && normType !== 'EXPENSE') {
      res.status(400).json({ success: false, message: 'type must be "income" or "expense"', timestamp: new Date().toISOString() });
      return;
    }
    if (!category || typeof category !== 'string') {
      res.status(400).json({ success: false, message: 'category is required', timestamp: new Date().toISOString() });
      return;
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: normType,
        category: category.trim(),
        description: (description as string | undefined)?.trim() || '(no description)',
        source: 'v1',
        date: date ? new Date(date) : new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Transaction created',
      data: transaction,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('V1 create transaction error', err);
    res.status(500).json({ success: false, message: 'Failed to create transaction', timestamp: new Date().toISOString() });
  }
};

// Canonical path from spec: POST /api/v1/transaction
router.post('/transaction', handleV1CreateTransaction);
// Backward-compatible alias
router.post('/finance/transaction', handleV1CreateTransaction);

// GET /api/v1/dashboard — current-month cashflow summary
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.user!.id;
    const data = await v1FinancialEngine.getCashflow(userId);
    res.json({ success: true, message: 'OK', data, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('V1 dashboard error', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard', timestamp: new Date().toISOString() });
  }
});

// POST /api/v1/insight — single AI insight (plain text in data.insight)
router.post('/insight', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.user!.id;
    const { query } = req.body ?? {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ success: false, message: 'query is required', timestamp: new Date().toISOString() });
      return;
    }
    const insight = await getInsight(userId, query.trim());
    res.json({ success: true, message: 'OK', data: { insight }, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('V1 insight error', err);
    res.status(500).json({ success: false, message: 'Failed to generate insight', timestamp: new Date().toISOString() });
  }
});

export default router;
