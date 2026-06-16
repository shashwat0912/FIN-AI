import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import logger from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { 
  securityHeaders, 
  rateLimiter, 
  authRateLimiter, 
  validateRequest, 
  corsOptions, 
  securityLogger, 
  environmentValidator,
  generateCsrfToken,
  validateCsrfToken
} from './middleware/security';
import routes from './routes';
import { startStateExpiryJob } from './jobs/stateExpiryJob';
import { startIdempotencyCleanupJob } from './jobs/idempotencyCleanupJob';
import { startSummarizationJob } from './jobs/summarizationJob';

const app = express();

// Enhanced Security middleware
app.use(securityHeaders);
app.use(environmentValidator);
app.use(securityLogger);

// CORS configuration
app.use(cors(corsOptions));

// Rate limiting
app.use(rateLimiter);
app.use(generalLimiter);

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
  return app.listen(PORT, () => {
    logger.info(`🚀 Finance AI Backend running on port ${PORT}`);
    logger.info(`📊 Environment: ${config.NODE_ENV}`);
    logger.info(`🔗 API Base URL: http://localhost:${PORT}/api/${config.API_VERSION}`);
    logger.info(`💊 Health Check: http://localhost:${PORT}/api/${config.API_VERSION}/health`);

    // Start background jobs
    startStateExpiryJob();
    startIdempotencyCleanupJob();
    startSummarizationJob();
  });
}

// Prevent opening a network port during tests/imported usage.
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
