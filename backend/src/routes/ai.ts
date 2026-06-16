import { Router } from 'express';
import { AiController } from '../controllers/aiController';
import { validate, aiSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();
const aiController = new AiController();

// All routes require authentication
router.use(authenticateToken);

// AI routes
router.post('/advice', aiLimiter, validate(aiSchemas.advice), aiController.getAdvice);
router.get('/history', aiController.getHistory);
router.delete('/sessions/:id', aiController.deleteSession);

export default router;
