import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import productRoutes from './routes/product';
import referralRoutes from './routes/referral';
import adminRoutes from './routes/admin';
import { generalLimiter, loginLimiter, registerLimiter, adminLimiter } from './middleware/rateLimiter';

dotenv.config();

// CRITICAL: Validate required environment variables on startup
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Required environment variables:');
  console.error('   DATABASE_URL: PostgreSQL connection string');
  console.error('   JWT_SECRET: Secret for JWT token signing');
  console.error('   REDIS_URL: Redis connection string');
  console.error('\n🔧 For Cloud Run, ensure secrets are properly configured.');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy (required for Cloud Run / Firebase Hosting / Load Balancer)
// Trust the number of proxies between user and server (Firebase Hosting -> Load Balancer -> Cloud Run = 2 hops)
app.set('trust proxy', 2);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow Firebase Hosting
  crossOriginEmbedderPolicy: false,
}));

// Compression middleware
app.use(compression());

// CORS middleware - PRODUCTION ONLY DEFAULTS
app.use(cors({
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://doac-perks.com' : 'http://localhost:3000'),
  credentials: true
}));

// Cookie parsing middleware
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root route (for load balancer health checks)
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes with rate limiting
// Note: Auth routes have endpoint-specific rate limiting (login vs register)
app.use('/api/auth', authRoutes);
app.use('/api/user', generalLimiter, userRoutes);
app.use('/api/products', generalLimiter, productRoutes);
app.use('/api/referral', referralRoutes); // Has its own specific rate limiting
app.use('/api/admin', adminLimiter, adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export for serverless functions
export default app;

// Start server (Cloud Run sets PORT env variable)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
  });
}
