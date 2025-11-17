import { Router } from 'express';
import { register, login, getProfile, logout } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply specific rate limiters to each endpoint
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/logout', authenticateToken, logout);
// NO rate limiting on profile check - it's just reading session cookie
router.get('/profile', authenticateToken, getProfile);

export default router;
