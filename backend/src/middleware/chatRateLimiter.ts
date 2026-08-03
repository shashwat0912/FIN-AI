import rateLimit from 'express-rate-limit';
import { createRateLimitStore, rateLimitKey } from '../services/securityStateService';

export const chatMessageLimiter = rateLimit({
  store: createRateLimitStore('chat-message'),
  keyGenerator: rateLimitKey,
  passOnStoreError: false,
  windowMs: 60 * 1000,
  max: 30,
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
  store: createRateLimitStore('chat-confirm'),
  keyGenerator: rateLimitKey,
  passOnStoreError: false,
  windowMs: 60 * 1000,
  max: 60,
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
  store: createRateLimitStore('chat-history'),
  keyGenerator: rateLimitKey,
  passOnStoreError: false,
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
