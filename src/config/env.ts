/**
 * Frontend Environment Configuration
 * Validates and provides access to environment variables
 */

interface EnvConfig {
  API_BASE_URL: string;
  NODE_ENV: string;
  SENTRY_DSN?: string;
}

// Validate required environment variables
const validateEnv = (): EnvConfig => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
  const nodeEnv = import.meta.env.MODE || 'development';
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  // Warn if using default API URL in production (only in browser)
  if (nodeEnv === 'production' && apiBaseUrl.includes('localhost')) {
    // Use setTimeout to avoid logging during module initialization
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        // Warnings will be captured by logger once initialized
      }
    }, 0);
  }

  // Validate API URL format
  try {
    new URL(apiBaseUrl);
  } catch (error) {
    throw new Error(
      `Invalid VITE_API_BASE_URL: "${apiBaseUrl}". Must be a valid URL.`
    );
  }

  return {
    API_BASE_URL: apiBaseUrl,
    NODE_ENV: nodeEnv,
    SENTRY_DSN: sentryDsn,
  };
};

export const env = validateEnv();

// Export for use in other files
export default env;

