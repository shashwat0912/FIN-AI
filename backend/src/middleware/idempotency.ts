import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { IdempotencyService } from '../services/chat/idempotencyService';
import { AuthenticatedRequest } from '../types';
import logger from '../config/logger';

const idempotencyService = new IdempotencyService();

function sendConflict(res: Response, error: string, message: string): void {
  res.status(409).json({
    success: false,
    error,
    message,
    timestamp: new Date().toISOString(),
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = typeof req.headers['x-idempotency-key'] === 'string' ? req.headers['x-idempotency-key'] : undefined;
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!key || !userId) {
    next();
    return;
  }

  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');

  try {
    const result = await idempotencyService.check(key, userId, req.path);

    if (result.status === 'conflict') {
      sendConflict(res, 'IDEMPOTENCY_KEY_REUSE', 'This idempotency key belongs to another request.');
      return;
    }

    if (result.status === 'processing') {
      sendConflict(res, 'REQUEST_IN_PROGRESS', 'This request is already being processed.');
      return;
    }

    if (result.status === 'completed') {
      if (result.requestHash !== requestHash) {
        sendConflict(res, 'IDEMPOTENCY_KEY_REUSE', 'This idempotency key was used with a different request payload.');
        return;
      }
      if (!result.cachedResponse) {
        sendConflict(
          res,
          'IDEMPOTENCY_RESPONSE_UNAVAILABLE',
          'This request already completed, but its response is unavailable.'
        );
        return;
      }
      try {
        res.status(200).json(JSON.parse(result.cachedResponse));
      } catch {
        sendConflict(
          res,
          'IDEMPOTENCY_RESPONSE_UNAVAILABLE',
          'This request already completed, but its response is invalid.'
        );
      }
      return;
    }

    try {
      await idempotencyService.create(key, userId, req.path, requestHash);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        sendConflict(res, 'REQUEST_IN_PROGRESS', 'This request is already being processed.');
        return;
      }
      throw error;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const finalize =
        res.statusCode >= 400
          ? idempotencyService.markFailed(key)
          : idempotencyService.markCompleted(key, JSON.stringify(body));
      void finalize.catch((error: unknown) => logger.error('Failed to finalize idempotent response', error));
      return originalJson(body);
    }) as Response['json'];
    next();
  } catch (error: unknown) {
    logger.error('Idempotency check failed', error);
    res.status(503).json({
      success: false,
      error: 'IDEMPOTENCY_UNAVAILABLE',
      message: 'Request safety checks are temporarily unavailable. Please retry.',
      timestamp: new Date().toISOString(),
    });
  }
}
