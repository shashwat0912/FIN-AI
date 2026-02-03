/**
 * Token Refresh Service
 * Centralized service for managing token refresh operations
 * Prevents race conditions by queuing refresh requests
 */

import { apiClient } from '../lib/api';
import { shouldRefreshToken, isTokenExpired, getTimeUntilExpiration } from '../utils/jwtUtils';
import { logger } from '../utils/logger';

interface RefreshPromise {
  resolve: (tokens: { accessToken: string; refreshToken: string }) => void;
  reject: (error: Error) => void;
}

class TokenRefreshService {
  private refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;
  private refreshInProgress = false;
  private backgroundRefreshTimer: NodeJS.Timeout | null = null;
  private refreshListeners: Set<(tokens: { accessToken: string; refreshToken: string }) => void> = new Set();

  /**
   * Refresh access token using refresh token
   * Uses a queue system to prevent multiple simultaneous refresh attempts
   */
  async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    // If refresh is already in progress, return the existing promise
    if (this.refreshInProgress && this.refreshPromise) {
      return this.refreshPromise;
    }

    // Check if refresh token exists
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      const error = new Error('No refresh token available');
      logger.error('Token refresh failed: No refresh token', error);
      throw error;
    }

    // Check if refresh token is expired
    if (isTokenExpired(refreshToken)) {
      const error = new Error('Refresh token expired. Please login again.');
      logger.error('Token refresh failed: Refresh token expired', error);
      this.clearTokens();
      throw error;
    }

    // Create new refresh promise
    this.refreshInProgress = true;
    this.refreshPromise = this.performRefresh(refreshToken);

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshInProgress = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      logger.info('Refreshing access token...');

      // Use apiClient.refreshAccessToken which makes direct API call
      const response = await apiClient.refreshAccessToken();

      // Store new tokens
      apiClient.setAccessToken(response.accessToken);
      apiClient.setRefreshToken(response.refreshToken);

      const tokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      // Broadcast token update to other tabs
      const { sessionSyncService } = await import('./sessionSyncService');
      sessionSyncService.broadcastTokenUpdate(tokens);

      // Notify all listeners
      this.notifyListeners(tokens);

      logger.info('Token refreshed successfully');
      return tokens;
    } catch (error: any) {
      logger.error('Token refresh failed', error);
      
      // Clear tokens on refresh failure
      this.clearTokens();
      
      throw new Error(error.message || 'Failed to refresh token. Please login again.');
    }
  }

  /**
   * Check if token needs refresh and refresh if needed
   */
  async ensureTokenValid(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!accessToken) {
      return; // No token to check
    }

    // If access token is expired or about to expire, try to refresh
    if (shouldRefreshToken(accessToken, 5 * 60 * 1000)) {
      if (!refreshToken) {
        // No refresh token available, cannot refresh
        throw new Error('No refresh token available. Please login again.');
      }
      
      try {
        await this.refreshToken();
      } catch (error: any) {
        logger.error('Failed to refresh token during ensureTokenValid', error);
        // Re-throw the error so caller knows refresh failed
        throw error;
      }
    }
  }

  /**
   * Start background token refresh timer
   * Automatically refreshes tokens before they expire
   */
  startBackgroundRefresh(): void {
    this.stopBackgroundRefresh(); // Clear any existing timer

    const checkAndRefresh = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        
        // Don't run background refresh if no tokens exist (user is not logged in)
        if (!accessToken || !refreshToken) {
          return;
        }

        // Check if refresh token is expired - if so, don't try to refresh
        if (isTokenExpired(refreshToken)) {
          // Refresh token expired, clear tokens silently
          this.clearTokens();
          return;
        }

        // Check if access token expires within 1 hour
        if (shouldRefreshToken(accessToken, 60 * 60 * 1000)) {
          logger.info('Background token refresh triggered');
          await this.refreshToken();
        }
      } catch (error: unknown) {
        // Silently handle refresh failures - don't throw errors
        // This prevents errors from affecting the UI when user is on login form
        logger.error('Background token refresh failed', error instanceof Error ? error : new Error(String(error)));
        
        // If refresh fails, clear tokens silently (user will need to login again)
        // But don't throw - this is background operation, shouldn't affect UI
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken && isTokenExpired(refreshToken)) {
          this.clearTokens();
        }
      }
    };

    // Check immediately (but only if tokens exist)
    checkAndRefresh();

    // Then check every 5 minutes
    this.backgroundRefreshTimer = setInterval(checkAndRefresh, 5 * 60 * 1000);
    
    logger.info('Background token refresh service started');
  }

  /**
   * Stop background token refresh timer
   */
  stopBackgroundRefresh(): void {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
      logger.info('Background token refresh service stopped');
    }
  }

  /**
   * Clear all tokens
   */
  private clearTokens(): void {
    apiClient.clearTokens();
    this.stopBackgroundRefresh();
  }

  /**
   * Add listener for token refresh events
   */
  addRefreshListener(listener: (tokens: { accessToken: string; refreshToken: string }) => void): () => void {
    this.refreshListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.refreshListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of token refresh
   */
  private notifyListeners(tokens: { accessToken: string; refreshToken: string }): void {
    this.refreshListeners.forEach(listener => {
      try {
        listener(tokens);
      } catch (error: unknown) {
        logger.error('Error in token refresh listener', error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Get current token status
   */
  getTokenStatus(): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    accessTokenExpired: boolean;
    refreshTokenExpired: boolean;
    timeUntilExpiration: number | null;
  } {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    return {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessTokenExpired: accessToken ? isTokenExpired(accessToken) : true,
      refreshTokenExpired: refreshToken ? isTokenExpired(refreshToken) : true,
      timeUntilExpiration: accessToken ? getTimeUntilExpiration(accessToken) : null,
    };
  }
}

// Export singleton instance
export const tokenRefreshService = new TokenRefreshService();

