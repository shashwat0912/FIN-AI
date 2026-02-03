import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController';
import { validate, settingsSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const settingsController = new SettingsController();

// All routes require authentication
router.use(authenticateToken);

// Settings operations
router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

// Preferences operations
router.get('/preferences', settingsController.getPreferences);
router.put('/preferences', validate(settingsSchemas.preferences), settingsController.updatePreferences);

// Notification settings operations
router.get('/notifications', settingsController.getNotificationSettings);
router.put('/notifications', validate(settingsSchemas.notifications), settingsController.updateNotificationSettings);

export default router;
