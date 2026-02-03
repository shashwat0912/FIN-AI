import { Router } from 'express';
import { TransactionController } from '../controllers/transactionController';
import { validate, transactionSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const transactionController = new TransactionController();

// All routes require authentication
router.use(authenticateToken);

// Transaction CRUD operations
router.post('/', validate(transactionSchemas.create), transactionController.createTransaction);
router.get('/', transactionController.getTransactions);
router.get('/search', transactionController.searchTransactions);
router.get('/analytics', transactionController.getTransactionAnalytics);
router.get('/categories', transactionController.getCategories);
router.get('/:id', transactionController.getTransactionById);
router.put('/:id', validate(transactionSchemas.update), transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);

export default router;
