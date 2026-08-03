import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate, authSchemas } from '../middleware/validation';
import { authLimiter } from '../middleware/rateLimiter';
import { 
  authRateLimiter, 
  accountLockout, 
  clearFailedAttempts,
  perUserRateLimiter 
} from '../middleware/security';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Public routes with enhanced security
router.post('/register', 
  accountLockout(), 
  authRateLimiter, 
  authLimiter, 
  validate(authSchemas.register), 
  clearFailedAttempts,
  authController.register
);

router.post('/login', 
  accountLockout(), 
  authRateLimiter, 
  authLimiter, 
  validate(authSchemas.login), 
  authController.login
);

router.post('/refresh-token', authRateLimiter, authController.refreshToken);

// Protected routes with per-user rate limiting
router.post('/logout', 
  authenticateToken, 
  perUserRateLimiter(5, 5 * 60 * 1000, 'logout'), // 5 requests per 5 minutes
  authController.logout
);

router.post('/logout-all', 
  authenticateToken, 
  perUserRateLimiter(3, 5 * 60 * 1000, 'logout-all'), // 3 requests per 5 minutes
  authController.logoutAll
);

router.post('/set-password', 
  authenticateToken, 
  perUserRateLimiter(3, 10 * 60 * 1000, 'set-password'), // 3 requests per 10 minutes
  authController.setPassword
);

router.post('/change-password', 
  authenticateToken, 
  perUserRateLimiter(3, 10 * 60 * 1000, 'change-password'), // 3 requests per 10 minutes
  authController.changePassword
);

// OTP-based authentication routes
router.post('/send-otp',
  authRateLimiter,
  authLimiter,
  validate(authSchemas.sendOtp),
  authController.sendOtp
);

router.post('/verify-otp',
  authRateLimiter,
  authLimiter,
  validate(authSchemas.verifyOtp),
  authController.verifyOtp
);

export default router;
