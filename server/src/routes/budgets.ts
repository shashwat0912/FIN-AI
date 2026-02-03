import { Router } from 'express';
import { BudgetController } from '../controllers/budgetController';
import { validate, budgetSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const budgetController = new BudgetController();

// All routes require authentication
router.use(authenticateToken);

// Budget CRUD operations
router.get('/', budgetController.getBudgets);
router.get('/analytics', budgetController.getBudgetAnalytics);
router.get('/:id', budgetController.getBudgetById);
router.post('/', validate(budgetSchemas.create), budgetController.createBudget);
router.put('/:id', validate(budgetSchemas.update), budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

export default router;



