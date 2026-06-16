import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { IdempotencyService } from '../services/chat/idempotencyService';
import { AuthenticatedRequest } from '../types';
import logger from '../config/logger';

const idempotencyService = new IdempotencyService();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-idempotency-key'] as string | undefined;
  if (!key) {
    next();
    return;
  }

  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  if (!userId) {
    next();
    return;
  }

  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');

  idempotencyService
    .check(key, userId, req.path, requestHash)
    .then((result) => {
      switch (result.status) {
        case 'completed':
          if (result.requestHash !== requestHash) {
            res.status(409).json({
              success: false,
              error: 'IDEMPOTENCY_KEY_REUSE',
              message: 'This idempotency key was used with a different request payload.',
              timestamp: new Date().toISOString(),
            });
            return;
          }
          if (result.cachedResponse) {
            try {
              const cached = JSON.parse(result.cachedResponse);
              res.status(200).json(cached);
            } catch {
              res.status(200).json({ success: true, message: 'Cached', timestamp: new Date().toISOString() });
            }
            return;
          }
          next();
          return;

        case 'processing':
          res.status(409).json({
            success: false,
            error: 'REQUEST_IN_PROGRESS',
            message: 'This request is already being processed.',
            timestamp: new Date().toISOString(),
          });
          return;

        case 'new':
          idempotencyService
            .create(key, userId, req.path, requestHash)
            .then(() => {
              // Intercept the response to cache it
              const originalJson = res.json.bind(res);
              res.json = function (body: any) {
                idempotencyService
                  .markCompleted(key, JSON.stringify(body))
                  .catch((err) => logger.error('Failed to cache idempotent response', err));
                return originalJson(body);
              };
              next();
            })
            .catch((err) => {
              logger.error('Failed to create idempotency record', err);
              next();
            });
          return;
      }
    })
    .catch((err) => {
      logger.error('Idempotency check failed', err);
      next();
    });
}
