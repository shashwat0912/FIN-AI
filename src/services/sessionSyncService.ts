/**
 * Session Synchronization Service
 * Synchronizes authentication tokens across multiple browser tabs
 * Uses BroadcastChannel API for cross-tab communication
 */

import { tokenRefreshService } from './tokenRefreshService';
import { apiClient } from '../lib/api';
import { logger } from '../utils/logger';

interface SessionMessage {
  type: 'TOKEN_UPDATE' | 'LOGOUT' | 'LOGIN';
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  timestamp: number;
}

class SessionSyncService {
  private channel: BroadcastChannel | null = null;
  private channelName = 'finance-ai-session-sync';
  private isInitialized = false;

  /**
   * Initialize session synchronization
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }

    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      logger.warn('BroadcastChannel not supported, session sync disabled');
      return;
    }

    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.isInitialized = true;

      // Listen for messages from other tabs
      this.channel.addEventListener('message', this.handleMessage.bind(this));

      // Listen for token refresh events and broadcast to other tabs
      tokenRefreshService.addRefreshListener((tokens) => {
        this.broadcastTokenUpdate(tokens);
      });

      logger.info('Session synchronization service initialized');
    } catch (error) {
      logger.error('Failed to initialize session sync', error as Error);
    }
  }

  /**
   * Handle incoming messages from other tabs
   */
  private handleMessage(event: MessageEvent<SessionMessage>): void {
    try {
      const message = event.data;

      // Ignore messages from the same tab (check timestamp)
      if (message.timestamp && Math.abs(Date.now() - message.timestamp) < 100) {
        return; // Likely our own message
      }

      switch (message.type) {
        case 'TOKEN_UPDATE':
          if (message.tokens) {
            this.handleTokenUpdate(message.tokens);
          }
          break;

        case 'LOGOUT':
          this.handleLogout();
          break;

        case 'LOGIN':
          if (message.tokens) {
            this.handleLogin(message.tokens);
          }
          break;

        default:
          logger.warn('Unknown session sync message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Error handling session sync message', error as Error);
    }
  }

  /**
   * Handle token update from another tab
   */
  private handleTokenUpdate(tokens: { accessToken: string; refreshToken: string }): void {
    try {
      // Update tokens in this tab
      apiClient.setAccessToken(tokens.accessToken);
      apiClient.setRefreshToken(tokens.refreshToken);

      logger.info('Token updated from another tab');
    } catch (error) {
      logger.error('Error updating tokens from sync', error as Error);
    }
  }

  /**
   * Handle logout from another tab
   */
  private handleLogout(): void {
    try {
      apiClient.clearTokens();
      logger.info('Logged out due to logout in another tab');
      
      // Reload page to show login screen
      window.location.reload();
    } catch (error) {
      logger.error('Error handling logout from sync', error as Error);
    }
  }

  /**
   * Handle login from another tab
   */
  private handleLogin(tokens: { accessToken: string; refreshToken: string }): void {
    try {
      apiClient.setAccessToken(tokens.accessToken);
      apiClient.setRefreshToken(tokens.refreshToken);

      logger.info('Logged in from another tab');
      
      // Reload page to update UI
      window.location.reload();
    } catch (error) {
      logger.error('Error handling login from sync', error as Error);
    }
  }

  /**
   * Broadcast token update to other tabs
   */
  broadcastTokenUpdate(tokens: { accessToken: string; refreshToken: string }): void {
    if (!this.channel) {
      return;
    }

    try {
      const message: SessionMessage = {
        type: 'TOKEN_UPDATE',
        tokens,
        timestamp: Date.now(),
      };

      this.channel.postMessage(message);
      logger.debug('Token update broadcasted to other tabs');
    } catch (error) {
      logger.error('Error broadcasting token update', error as Error);
    }
  }

  /**
   * Broadcast logout to other tabs
   */
  broadcastLogout(): void {
    if (!this.channel) {
      return;
    }

    try {
      const message: SessionMessage = {
        type: 'LOGOUT',
        timestamp: Date.now(),
      };

      this.channel.postMessage(message);
      logger.info('Logout broadcasted to other tabs');
    } catch (error) {
      logger.error('Error broadcasting logout', error as Error);
    }
  }

  /**
   * Broadcast login to other tabs
   */
  broadcastLogin(tokens: { accessToken: string; refreshToken: string }): void {
    if (!this.channel) {
      return;
    }

    try {
      const message: SessionMessage = {
        type: 'LOGIN',
        tokens,
        timestamp: Date.now(),
      };

      this.channel.postMessage(message);
      logger.info('Login broadcasted to other tabs');
    } catch (error) {
      logger.error('Error broadcasting login', error as Error);
    }
  }

  /**
   * Close session synchronization
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
      this.isInitialized = false;
      logger.info('Session synchronization service closed');
    }
  }
}

// Export singleton instance
export const sessionSyncService = new SessionSyncService();



