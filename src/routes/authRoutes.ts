import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticateToken, resolveTenantDatabase } from '../middleware/authMiddleware.js';

const router = Router();

// Public routes
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);

// Protected routes
router.get('/me', authenticateToken, resolveTenantDatabase, AuthController.getMe);

export default router;
