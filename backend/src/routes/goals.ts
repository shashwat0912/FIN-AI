import { Router } from 'express';
import { GoalController } from '../controllers/goalController';
import { validate, goalSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { perUserRateLimiter } from '../middleware/security';
import { financeLedgerAuthLimiter } from '../middleware/rateLimiter';

const router = Router();
const goalController = new GoalController();

// All routes require authentication
router.use(financeLedgerAuthLimiter);
router.use(authenticateToken);
router.use(perUserRateLimiter(100, 15 * 60 * 1000, 'finance-ledger'));

// Goal CRUD operations
router.get('/', goalController.getGoals);
router.get('/analytics', goalController.getGoalAnalytics);
router.get('/:id', goalController.getGoalById);
router.post('/', validate(goalSchemas.create), goalController.createGoal);
router.put('/:id', validate(goalSchemas.update), goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

export default router;
