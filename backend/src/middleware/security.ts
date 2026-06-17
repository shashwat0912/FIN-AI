import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csrf';
import { createHash } from 'crypto';
import { config } from '../config/env';
import logger from '../config/logger';

// CSRF protection - use a single server-side secret for stateless verification
const csrfProtection = new csrf();

// Use an explicit CSRF secret when available. Otherwise derive a stable fallback from the JWT secret
// so server restarts do not invalidate every browser token during development.
const CSRF_SECRET = config.CSRF_SECRET ||
  createHash('sha256').update(`${config.JWT_SECRET}:finance-ai:csrf`).digest('hex');

// Warn if using derived secret in production
if (config.NODE_ENV === 'production' && !config.CSRF_SECRET) {
  logger.warn('CSRF_SECRET not set in environment. Falling back to a JWT-derived secret. Set CSRF_SECRET explicitly for multi-instance production deployments.');
}

// Enhanced security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  permittedCrossDomainPolicies: false,
  hidePoweredBy: true,
});

// Rate limiting middleware
export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.NODE_ENV === 'development' ? 1000 : config.RATE_LIMIT_MAX_REQUESTS, // Much more lenient in development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.NODE_ENV === 'development' ? 50 : 10, // More lenient in development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiting
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many API requests, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];

  const body = JSON.stringify(req.body);
  const query = JSON.stringify(req.query);
  const params = JSON.stringify(req.params);

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(body) || pattern.test(query) || pattern.test(params)) {
      res.status(400).json({
        success: false,
        message: 'Suspicious request detected',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  next();
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In development, allow all localhost origins
    if (config.NODE_ENV === 'development') {
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
        return callback(null, true);
      }
    }
    
    const allowedOrigins = config.CORS_ORIGIN.split(',').map(origin => origin.trim());
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: config.CORS_CREDENTIALS,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Idempotency-Key'],
  exposedHeaders: ['X-CSRF-Token'], // Allow frontend to read this header
};

// Security logging middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    };

    // Log security events
    if (res.statusCode >= 400) {
      logger.warn('Security Event', logData);
    } else {
      logger.info('Request processed', logData);
    }
  });

  next();
};

// Per-user rate limiting store (in production, use Redis)
const userRateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Per-user rate limiting middleware
export const perUserRateLimiter = (maxRequests: number = 10, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return next(); // Skip if no user ID
    }

    const now = Date.now();
    const key = `user:${userId}`;
    const userLimit = userRateLimitStore.get(key);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit
      userRateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests from this user, please try again later.',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
        timestamp: new Date().toISOString(),
      });
    }

    userLimit.count++;
    next();
  };
};

// Account lockout after failed login attempts
const failedAttempts = new Map<string, { count: number; lockoutUntil: number }>();

function getAuthAttemptKey(req: Request): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const ip = req.ip || 'unknown';
  return `${ip}:${email}`;
}

export const accountLockout = (maxAttempts: number = config.NODE_ENV === 'development' ? 20 : 5, lockoutDuration: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = getAuthAttemptKey(req);
    const now = Date.now();
    const attempt = failedAttempts.get(identifier);

    if (attempt && now < attempt.lockoutUntil) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts',
        retryAfter: Math.ceil((attempt.lockoutUntil - now) / 1000),
        timestamp: new Date().toISOString(),
      });
    }

    // Reset if lockout period has passed.
    if (attempt && attempt.lockoutUntil > 0 && now >= attempt.lockoutUntil) {
      failedAttempts.delete(identifier);
    }

    // Defensive: if attempts crossed threshold but lock wasn't set for any reason, enforce now.
    if (attempt && attempt.lockoutUntil === 0 && attempt.count >= maxAttempts) {
      attempt.lockoutUntil = now + lockoutDuration;
      failedAttempts.set(identifier, attempt);
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts',
        retryAfter: Math.ceil((attempt.lockoutUntil - now) / 1000),
        timestamp: new Date().toISOString(),
      });
    }

    next();
    return;
  };
};

// Record failed login attempt
export const recordFailedAttempt = (
  maxAttempts: number = config.NODE_ENV === 'development' ? 20 : 5,
  lockoutDuration: number = 15 * 60 * 1000
) => (req: Request, res: Response, next: NextFunction) => {
  const identifier = getAuthAttemptKey(req);

  res.on('finish', () => {
    // Count only authentication failures.
    if (res.statusCode !== 401) return;

    const now = Date.now();
    const current = failedAttempts.get(identifier);

    if (!current) {
      failedAttempts.set(identifier, {
        count: 1,
        lockoutUntil: 0,
      });
      return;
    }

    // If already locked, keep existing lock window.
    if (current.lockoutUntil > now) return;

    const nextCount = current.count + 1;
    if (nextCount >= maxAttempts) {
      failedAttempts.set(identifier, {
        count: nextCount,
        lockoutUntil: now + lockoutDuration,
      });
      return;
    }

    failedAttempts.set(identifier, {
      count: nextCount,
      lockoutUntil: 0,
    });
  });

  next();
};

// Clear failed attempts after successful login response.
export const clearFailedAttemptsOnSuccess = (req: Request, res: Response, next: NextFunction) => {
  const identifier = getAuthAttemptKey(req);

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      failedAttempts.delete(identifier);
    }
  });

  next();
};

// Clear failed attempts on successful login
export const clearFailedAttempts = (req: Request, res: Response, next: NextFunction) => {
  const identifier = getAuthAttemptKey(req);
  failedAttempts.delete(identifier);
  next();
};

// Environment validation middleware
export const environmentValidator = (req: Request, res: Response, next: NextFunction) => {
  // Check if we're in production and validate accordingly
  if (config.NODE_ENV === 'production') {

    // Allow Docker/Kubernetes health checks
    if (req.path.includes('/health')) {
      return next();
    }
  
    // Production-specific security checks
    const forwardedProto = req.get('X-Forwarded-Proto');
    const isSecure = req.secure || forwardedProto === 'https';
  
    if (!isSecure) {
      return res.status(400).json({
        success: false,
        message: 'HTTPS required in production',
        timestamp: new Date().toISOString(),
      });
    }
  }

  next();
  return;
};

// CSRF token generation middleware
// This generates a token using the server's persistent secret
// The token can be verified later without storing state
export const generateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Generate CSRF token using the persistent server secret
  const token = csrfProtection.create(CSRF_SECRET);
  
  // Set token in response header for initial page load
  res.setHeader('X-CSRF-Token', token);
  
  // Also set as cookie for easier client-side access
  res.cookie('csrf-token', token, {
    httpOnly: false, // Must be accessible to JavaScript
    secure: config.NODE_ENV === 'production', // HTTPS only in production
    sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax', // More permissive in dev
    maxAge: 24 * 3600000, // 24 hours
  });
  
  next();
};

// CSRF validation middleware (for POST, PUT, DELETE, PATCH requests)
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF validation for auth endpoints (login/register/OTP)
  // These endpoints use JWT tokens for authentication instead
  const authPaths = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh', '/api/v1/auth/send-otp', '/api/v1/auth/verify-otp'];
  const isAuthPath = authPaths.some(path => 
    req.path.includes('auth/login') || 
    req.path.includes('auth/register') || 
    req.path.includes('auth/refresh') ||
    req.path.includes('auth/send-otp') ||
    req.path.includes('auth/verify-otp')
  );
  
  if (isAuthPath) {
    next();
    return;
  }
  
  // Skip for safe HTTP methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  
  // Skip for health check endpoint
  if (req.path.includes('/health')) {
    next();
    return;
  }
  
  // Get token from header, body, or cookie (in order of preference)
  const token = req.headers['x-csrf-token'] as string || req.body?._csrf || req.cookies?.['csrf-token'];
  
  if (!token) {
    logger.warn('CSRF token missing', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  // Verify token using the persistent server secret
  if (!csrfProtection.verify(CSRF_SECRET, token)) {
    logger.warn('Invalid CSRF token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  next();
};
