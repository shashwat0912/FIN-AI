import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

export const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_VERSION: process.env.API_VERSION || 'v1',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Shared security state
  SECURITY_STATE_HMAC_SECRET:
    process.env.SECURITY_STATE_HMAC_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : process.env.JWT_SECRET!),

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',
  CSRF_SECRET: process.env.CSRF_SECRET || '',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10),
  AI_PROVIDER: process.env.AI_PROVIDER || 'auto', // auto | openai | local
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'auto', // auto | openai | local
  LOCAL_LLM_BASE_URL: process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434',
  LOCAL_LLM_MODEL: process.env.LOCAL_LLM_MODEL || 'llama3.1:8b',
  LOCAL_EMBEDDING_MODEL: process.env.LOCAL_EMBEDDING_MODEL || 'nomic-embed-text',
  OPENAI_TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS || '12000', 10),

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Email
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
};

// Enhanced Environment Validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Validate JWT secret strength - CRITICAL SECURITY
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required and must be provided');
}

if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is required and must be provided');
}

if (process.env.JWT_SECRET.length < 64) {
  throw new Error('JWT_SECRET must be at least 64 characters long for security');
}

if (process.env.JWT_REFRESH_SECRET.length < 64) {
  throw new Error('JWT_REFRESH_SECRET must be at least 64 characters long for security');
}

// Check for weak/commonly used secrets
const weakSecrets = [
  'fallback-secret-key',
  'fallback-refresh-secret',
  'your-super-secret-jwt-key-change-this-in-production',
  'your-super-secret-refresh-key-change-this-in-production',
  'secret',
  'password',
  '1234567890',
  'abcdefghijklmnopqrstuvwxyz',
];

if (weakSecrets.includes(process.env.JWT_SECRET)) {
  throw new Error('JWT_SECRET cannot use weak or default values. Generate a cryptographically secure secret.');
}

if (weakSecrets.includes(process.env.JWT_REFRESH_SECRET)) {
  throw new Error('JWT_REFRESH_SECRET cannot use weak or default values. Generate a cryptographically secure secret.');
}

// Enhanced environment-specific validation
if (config.NODE_ENV === 'production') {
  const securityStateHmacSecret = process.env.SECURITY_STATE_HMAC_SECRET;
  if (!securityStateHmacSecret) {
    throw new Error('SECURITY_STATE_HMAC_SECRET is required in production');
  }
  if (securityStateHmacSecret.length < 64) {
    throw new Error('SECURITY_STATE_HMAC_SECRET must be at least 64 characters long');
  }
  if (weakSecrets.includes(securityStateHmacSecret)) {
    throw new Error('SECURITY_STATE_HMAC_SECRET cannot use a weak or default value');
  }

  // Production-specific security validations
  if (config.CORS_ORIGIN.includes('localhost')) {
    throw new Error('CORS_ORIGIN cannot include localhost in production');
  }
  
  if (config.DATABASE_URL.includes('file:')) {
    throw new Error('SQLite database not allowed in production - use PostgreSQL or MySQL');
  }
  
        if (config.LOG_LEVEL === 'debug') {
          logger.warn('Debug logging enabled in production');
        }

  // Validate production database URL format
  if (!config.DATABASE_URL.startsWith('postgresql://') && !config.DATABASE_URL.startsWith('mysql://')) {
    throw new Error('Production database must use PostgreSQL or MySQL connection string');
  }

  // Validate CORS origins are HTTPS in production
  const corsOrigins = config.CORS_ORIGIN.split(',').map(origin => origin.trim());
  for (const origin of corsOrigins) {
    if (origin && !origin.startsWith('https://')) {
      throw new Error(`CORS origin must use HTTPS in production: ${origin}`);
    }
  }

  // Validate required production environment variables
  const requiredProductionVars = [
    'OPENAI_API_KEY', // If using AI features
  ];

          for (const envVar of requiredProductionVars) {
            if (!process.env[envVar] || process.env[envVar] === '') {
              logger.warn(`${envVar} not set - some features may not work`);
            }
          }

  // Security warnings for production
  if (config.RATE_LIMIT_MAX_REQUESTS > 1000) {
    logger.warn('High rate limit in production - consider reducing for security');
  }

  if (config.JWT_EXPIRES_IN === '1d' || config.JWT_EXPIRES_IN === '7d') {
    logger.warn('Long JWT expiration in production - consider shorter duration');
  }
}

// Security status logging
logger.info('JWT secrets validated successfully');

// Log environment status
logger.info(`Environment: ${config.NODE_ENV}`);
logger.info(`CORS Origin: ${config.CORS_ORIGIN}`);
logger.info(`Rate Limit: ${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW_MS}ms`);
logger.info(`JWT Secret Length: ${process.env.JWT_SECRET?.length || 0} characters`);
logger.info(`JWT Refresh Secret Length: ${process.env.JWT_REFRESH_SECRET?.length || 0} characters`);
