/**
 * JWT Utility Functions
 * Decode JWT tokens without verification to check expiration
 * This allows us to proactively refresh tokens before they expire
 */

export interface DecodedToken {
  userId?: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  [key: string]: any;
}

/**
 * Decode JWT token without verification
 * Only extracts the payload to check expiration
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    if (!token) {
      return null;
    }

    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode base64url payload
    const payload = parts[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as DecodedToken;

    return decoded;
  } catch (error) {
    // Silent fail for invalid tokens - this is expected when tokens are malformed
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true; // Consider invalid tokens as expired
  }

  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  
  return currentTime >= expirationTime;
}

/**
 * Get token expiration time in milliseconds
 */
export function getTokenExpirationTime(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  return decoded.exp * 1000; // Convert to milliseconds
}

/**
 * Get time remaining until token expiration in milliseconds
 * Returns negative number if token is expired
 */
export function getTimeUntilExpiration(token: string): number | null {
  const expirationTime = getTokenExpirationTime(token);
  if (expirationTime === null) {
    return null;
  }

  return expirationTime - Date.now();
}

/**
 * Check if token needs refresh
 * Returns true if token expires within the specified buffer time
 * @param token - JWT token string
 * @param bufferMs - Buffer time in milliseconds before expiration (default: 5 minutes)
 */
export function shouldRefreshToken(token: string, bufferMs: number = 5 * 60 * 1000): boolean {
  if (!token) {
    return false;
  }

  if (isTokenExpired(token)) {
    return true; // Already expired, needs refresh
  }

  const timeUntilExpiration = getTimeUntilExpiration(token);
  if (timeUntilExpiration === null) {
    return true; // Can't determine expiration, refresh to be safe
  }

  // Refresh if token expires within buffer time
  return timeUntilExpiration <= bufferMs;
}

/**
 * Get token expiration date
 */
export function getTokenExpirationDate(token: string): Date | null {
  const expirationTime = getTokenExpirationTime(token);
  if (expirationTime === null) {
    return null;
  }

  return new Date(expirationTime);
}

/**
 * Format time until expiration as human-readable string
 */
export function formatTimeUntilExpiration(token: string): string {
  const timeMs = getTimeUntilExpiration(token);
  
  if (timeMs === null) {
    return 'Unknown';
  }

  if (timeMs < 0) {
    return 'Expired';
  }

  const seconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Extract user information from token
 */
export function getUserFromToken(token: string): { userId?: string; email?: string; role?: string } | null {
  const decoded = decodeToken(token);
  if (!decoded) {
    return null;
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}



