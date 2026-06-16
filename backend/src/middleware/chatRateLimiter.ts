import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest } from '../types';

function userKeyGenerator(req: any): string {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.id || req.ip || 'anonymous';
}

export const chatMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `chat:msg:${userKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Too many messages. Please wait a moment.',
      timestamp: new Date().toISOString(),
    });
  },
});

export const chatConfirmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `chat:confirm:${userKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please wait.',
      timestamp: new Date().toISOString(),
    });
  },
});

export const chatHistoryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `chat:history:${userKeyGenerator(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
});
