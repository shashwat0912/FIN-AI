// Ensure deterministic defaults for local + CI test runs.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.API_VERSION = process.env.API_VERSION || 'v1';
process.env.PORT = process.env.PORT || '3001';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'b'.repeat(64);
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.CORS_CREDENTIALS = process.env.CORS_CREDENTIALS || 'true';

process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = process.env.RATE_LIMIT_MAX_REQUESTS || '100';
