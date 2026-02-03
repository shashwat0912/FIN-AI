import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { validate, userSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticateToken);

// User profile operations
router.get('/profile', userController.getProfile);
router.put('/profile', validate(userSchemas.updateProfile), userController.updateProfile);
router.get('/stats', userController.getUserStats);

// Avatar operations
router.post('/avatar', validate(userSchemas.uploadAvatar), userController.uploadAvatar);
router.delete('/avatar', userController.deleteAvatar);

// Password operations
router.post('/change-password', validate(userSchemas.changePassword), userController.changePassword);

export default router;



