import { Router } from 'express';
import { BudgetController } from '../controllers/budgetController';
import { validate, budgetSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { perUserRateLimiter } from '../middleware/security';
import { financeLedgerAuthLimiter } from '../middleware/rateLimiter';

const router = Router();
const budgetController = new BudgetController();

// All routes require authentication
router.use(financeLedgerAuthLimiter);
router.use(authenticateToken);
router.use(perUserRateLimiter(100, 15 * 60 * 1000, 'finance-ledger'));

// Budget CRUD operations
router.get('/', budgetController.getBudgets);
router.get('/analytics', budgetController.getBudgetAnalytics);
router.get('/:id', budgetController.getBudgetById);
router.post('/', validate(budgetSchemas.create), budgetController.createBudget);
router.put('/:id', validate(budgetSchemas.update), budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

export default router;
