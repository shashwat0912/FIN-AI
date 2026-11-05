import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { chatMessageLimiter } from '../middleware/chatRateLimiter';
import { adviseUser } from '../advisor/service';
import { validateInput } from '../advisor/validation';
import type { AuthenticatedRequest } from '../types';
const router = Router();
router.use(authenticateToken, chatMessageLimiter);
router.post('/', async (req: AuthenticatedRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let input;
  try {
    input = validateInput(req.body);
  } catch {
    res.status(400).json({
      success: false,
      message: 'Provide a question (3–1200 characters) and valid optional simulation parameters.',
    });
    return;
  }
  try {
    const data = await adviseUser(req.user!.id, input);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch {
    res
      .status(503)
      .json({ success: false, message: 'Finance Advisor is unavailable. Please try again.' });
  }
});
export default router;
