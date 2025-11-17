import { Router } from 'express';
import { register, login, getProfile, logout, forgotPassword, verifyResetCode, resetPassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  verifyResetCodeLimiter,
  resetPasswordLimiter
} from '../middleware/rateLimiter';

const router = Router();

// Apply specific rate limiters to each endpoint
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/logout', authenticateToken, logout);
// NO rate limiting on profile check - it's just reading session cookie
router.get('/profile', authenticateToken, getProfile);

// Password reset endpoints with strict rate limiting
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/verify-reset-code', verifyResetCodeLimiter, verifyResetCode);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

export default router;
