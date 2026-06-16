import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { chatMessageLimiter, chatConfirmLimiter, chatHistoryLimiter } from '../middleware/chatRateLimiter';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { chatSchemas } from '../middleware/validation';

const router = Router();
const chatController = new ChatController();

router.use(authenticateToken);

router.post(
  '/message',
  chatMessageLimiter,
  validate(chatSchemas.message),
  idempotencyMiddleware,
  (req, res) => chatController.postMessage(req as any, res)
);

router.post(
  '/confirm',
  chatConfirmLimiter,
  validate(chatSchemas.confirm),
  idempotencyMiddleware,
  (req, res) => chatController.confirmAction(req as any, res)
);

router.post(
  '/edit',
  chatConfirmLimiter,
  validate(chatSchemas.edit),
  idempotencyMiddleware,
  (req, res) => chatController.editAction(req as any, res)
);

router.get(
  '/history',
  chatHistoryLimiter,
  (req, res) => chatController.getHistory(req as any, res)
);

export default router;
