import { useState, useEffect } from 'react';
import { apiClient, User, AuthResponse } from '../lib/api';
import { tokenRefreshService } from '../services/tokenRefreshService';
import { getUserFromToken } from '../utils/jwtUtils';
import { logger } from '../utils/logger';

export function useBackendAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        
        if (accessToken) {
          // Try to refresh token if it's expired or about to expire
          try {
            await tokenRefreshService.ensureTokenValid();
          } catch (refreshError) {
            // Token refresh failed, user needs to login
            apiClient.clearTokens();
            setLoading(false);
            return;
          }

          // Get user info from token
          const tokenUser = getUserFromToken(accessToken);
          
          if (tokenUser && tokenUser.userId) {
            setUser({
              id: tokenUser.userId,
              email: tokenUser.email || 'user@example.com',
              name: 'User',
              role: (tokenUser.role as any) || 'USER',
            });
          } else {
            // Fallback: try to make authenticated request
            try {
              const healthResponse = await apiClient.healthCheck();
              if (healthResponse) {
                setUser({
                  id: 'current-user',
                  email: 'user@example.com',
                  name: 'Current User',
                  role: 'USER',
                });
              }
            } catch (apiError) {
              // API call failed, clear tokens
              apiClient.clearTokens();
            }
          }
        }
      } catch (error) {
        logger.error('Auth check failed:', error instanceof Error ? error : new Error(String(error)));
        apiClient.clearTokens();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const response: AuthResponse = await apiClient.login(email, password);
      
      // Store refresh token
      apiClient.setRefreshToken(response.refreshToken);
      
      setUser(response.user);
    } catch (error: any) {
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const response: AuthResponse = await apiClient.register(email, password, name);
      
      // Store refresh token
      apiClient.setRefreshToken(response.refreshToken);
      
      setUser(response.user);
    } catch (error: any) {
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout();
      setUser(null);
    } catch (error) {
      logger.error('Logout error:', error instanceof Error ? error : new Error(String(error)));
      // Clear local state even if API call fails
      setUser(null);
    }
  };

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };
}
