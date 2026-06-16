import { Router } from 'express';
import { KnowledgeController } from '../controllers/knowledgeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const knowledgeController = new KnowledgeController();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Knowledge management routes
router.post('/chunks', knowledgeController.addChunk);
router.post('/chunks/batch', knowledgeController.addChunks);
router.put('/chunks/:id', knowledgeController.updateChunk);
router.delete('/chunks/:id', knowledgeController.deleteChunk);
router.get('/chunks/category/:category', knowledgeController.getChunksByCategory);
router.get('/stats', knowledgeController.getStats);

export default router;


