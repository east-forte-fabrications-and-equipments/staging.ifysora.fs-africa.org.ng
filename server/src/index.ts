import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/authRoutes.js';
import measurementRoutes from './routes/measurementRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

const app = express();
const port = env.PORT;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW,
  max: env.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later.',
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ifysora',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
app.listen(port, () => {
  logger.info(`🚀 iFYSORA server running on port ${port}`);
  logger.info(`🔐 Environment: ${env.NODE_ENV}`);
  logger.info(`🤖 Gemini AI: ${env.GEMINI_API_KEY ? 'Enabled' : 'Disabled'}`);
  logger.info(`🔄 Sync to FYSORA FASHN: ${env.FYSORA_FASHN_API_KEY ? 'Enabled' : 'Disabled'}`);
});

export default app;
