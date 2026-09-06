import { Router } from 'express';
import { register, login, me, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for auth routes to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: { success: false, message: 'Too many authentication attempts, please try again later' }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate, me);

export default router;
