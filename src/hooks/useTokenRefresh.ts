/**
 * React Hook for Token Refresh Management
 * Manages background token refresh and session synchronization
 */

import { useEffect, useRef } from 'react';
import { tokenRefreshService } from '../services/tokenRefreshService';
import { logger } from '../utils/logger';

/**
 * Hook to manage token refresh in a React component
 * Starts background refresh timer and handles cleanup
 */
export function useTokenRefresh() {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    // Start background token refresh service
    tokenRefreshService.startBackgroundRefresh();

    logger.info('Token refresh service initialized');

    // Cleanup on unmount
    return () => {
      tokenRefreshService.stopBackgroundRefresh();
      logger.info('Token refresh service stopped');
    };
  }, []);

  return {
    refreshToken: () => tokenRefreshService.refreshToken(),
    ensureTokenValid: () => tokenRefreshService.ensureTokenValid(),
    getTokenStatus: () => tokenRefreshService.getTokenStatus(),
  };
}



