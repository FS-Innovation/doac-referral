import { Router } from 'express';
import { register, login, getProfile, logout, forgotPassword, validateResetToken, resetPassword, verifyEmail, resendVerification, getVerificationStatus } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  verifyResetCodeLimiter,
  resetPasswordLimiter,
  generalLimiter
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
router.post('/validate-reset-token', verifyResetCodeLimiter, validateResetToken);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

// Email verification endpoints
router.post('/verify-email', generalLimiter, verifyEmail);
router.post('/resend-verification', authenticateToken, generalLimiter, resendVerification);
router.get('/verification-status', authenticateToken, getVerificationStatus);

export default router;
