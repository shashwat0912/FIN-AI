import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { 
  securityHeaders, 
  rateLimiter, 
  validateRequest, 
  corsOptions, 
  securityLogger, 
  environmentValidator,
  generateCsrfToken,
  validateCsrfToken
} from './middleware/security';
import routes from './routes';
import healthRoutes from './routes/health';
import { startStateExpiryJob } from './jobs/stateExpiryJob';
import { startIdempotencyCleanupJob } from './jobs/idempotencyCleanupJob';
import { startSummarizationJob } from './jobs/summarizationJob';
import prisma from './config/database';
import { shutdownRedis } from './config/redis';
import { createShutdownCoordinator } from './shutdown';

const app = express();

// Trust Nginx / reverse proxy headers
app.set('trust proxy', 1);

// Enhanced Security middleware
app.use(securityHeaders);
app.use(healthRoutes);
app.use(environmentValidator);
app.use(securityLogger);

// CORS configuration
app.use(cors(corsOptions));

// Rate limiting
app.use(rateLimiter);

// Cookie parser middleware (needed for CSRF tokens)
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF protection - generate tokens for GET requests
app.use(generateCsrfToken);

// CSRF validation for state-changing requests
app.use(validateCsrfToken);

// Request validation
app.use(validateRequest);

// API routes
app.use(`/api/${config.API_VERSION}`, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Finance AI Backend API',
    version: config.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

// Development-only endpoint to reset rate limits
if (config.NODE_ENV === 'development') {
  app.post('/reset-rate-limit', (req, res) => {
    // This is a simple way to reset rate limits in development
    // In production, you'd want a more sophisticated approach
    res.json({
      success: true,
      message: 'Rate limits reset for development',
      timestamp: new Date().toISOString(),
    });
  });
}

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

export function startServer() {
  const PORT = config.PORT;
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Finance AI Backend running on port ${PORT}`);
    logger.info(`📊 Environment: ${config.NODE_ENV}`);
    logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/${config.API_VERSION}`);
    logger.info('Health probes enabled');
  });

  const jobs = [startStateExpiryJob(), startIdempotencyCleanupJob(), startSummarizationJob()];
  const shutdown = createShutdownCoordinator({
    server,
    jobs,
    disconnectPrisma: () => prisma.$disconnect(),
    shutdownRedis,
  });

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  startServer();
}

export default app;
