import { logger } from './logger';

/**
 * Utility function to clear all authentication tokens
 * Use this if you're getting "INVALID TOKEN" errors
 */
export function clearAllTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  logger.info('All tokens cleared');
  window.location.reload();
}

// Make it available globally for browser console (development only)
if (typeof window !== 'undefined') {
  (window as any).clearTokens = clearAllTokens;
  if (import.meta.env.DEV) {
    logger.info('Tip: Run clearTokens() in the browser console to clear expired tokens');
  }
}



