import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { mvpController } from './mvpController';

const router = Router();

router.use(authenticateToken);
router.post('/chat', (req, res) => {
  void mvpController.handleChat(req as any, res);
});

export default router;
