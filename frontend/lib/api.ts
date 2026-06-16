import { ApiResponse, User, AuthResponse, Transaction, Budget, Goal, AiAdvice, SendOtpRequest, SendOtpResponse, VerifyOtpRequest } from '../types';
import { tokenRefreshService } from '../services/tokenRefreshService';
import { sessionSyncService } from '../services/sessionSyncService';
import { shouldRefreshToken, isTokenExpired } from '../utils/jwtUtils';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// API configuration
const API_BASE_URL = env.API_BASE_URL;

// API Client class
class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private csrfToken: string | null = null;
  private csrfBootstrapPromise: Promise<string | null> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.accessToken = localStorage.getItem('accessToken');
    this.csrfToken = this.getCsrfTokenFromCookie();
  }

  // Get CSRF token from cookie
  private getCsrfTokenFromCookie(): string | null {
    if (typeof document === 'undefined') {
      return null;
    }
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf-token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  // Update CSRF token from response headers
  private updateCsrfToken(response: Response): void {
    const csrfToken = response.headers.get('X-CSRF-Token');
    if (csrfToken) {
      this.csrfToken = csrfToken;
    }
  }

  private isAuthEndpoint(endpoint: string): boolean {
    return endpoint === '/auth/login' ||
      endpoint === '/auth/register' ||
      endpoint === '/auth/refresh-token' ||
      endpoint === '/auth/send-otp' ||
      endpoint === '/auth/verify-otp';
  }

  private isCsrfBootstrapEndpoint(endpoint: string): boolean {
    return endpoint === '/csrf-token' || endpoint === '/health';
  }

  private getBestCsrfToken(): string | null {
    const cookieToken = this.getCsrfTokenFromCookie();
    if (this.csrfToken) {
      return this.csrfToken;
    }
    if (cookieToken) {
      this.csrfToken = cookieToken;
    }
    return cookieToken;
  }

  private async ensureCsrfToken(forceRefresh = false): Promise<string | null> {
    const existingToken = this.getBestCsrfToken();
    if (!forceRefresh && existingToken) {
      return existingToken;
    }

    if (this.csrfBootstrapPromise && !forceRefresh) {
      return this.csrfBootstrapPromise;
    }

    const bootstrapRequest = (async () => {
      const response = await fetch(`${this.baseURL}/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      this.updateCsrfToken(response);

      if (!response.ok) {
        throw new Error(`Failed to initialize CSRF protection (HTTP ${response.status})`);
      }

      try {
        const payload = await response.json();
        const tokenFromBody = payload?.data?.token;
        if (typeof tokenFromBody === 'string' && tokenFromBody.trim()) {
          this.csrfToken = tokenFromBody;
        }
      } catch {
        // Header/cookie token is sufficient; body parsing is best-effort.
      }

      return this.getBestCsrfToken();
    })();

    this.csrfBootstrapPromise = bootstrapRequest;

    try {
      return await bootstrapRequest;
    } finally {
      this.csrfBootstrapPromise = null;
    }
  }

  private isCsrfError(status: number, message: string): boolean {
    if (status !== 403) {
      return false;
    }

    return /csrf token/i.test(message);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOn401 = true,
    retryOnCsrf = true
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Update access token from localStorage in case it changed
    this.accessToken = localStorage.getItem('accessToken');

    // PROACTIVE TOKEN REFRESH: Check if token needs refresh before making request
    // Skip token refresh check for auth endpoints
    const isAuthEndpoint = this.isAuthEndpoint(endpoint);
    
    if (!isAuthEndpoint && this.accessToken) {
      // Check if token expires within 5 minutes and refresh proactively
      const refreshToken = localStorage.getItem('refreshToken');
      
      // Only try to refresh if we have a valid refresh token
      if (refreshToken && !isTokenExpired(refreshToken) && shouldRefreshToken(this.accessToken, 5 * 60 * 1000)) {
        try {
          await tokenRefreshService.ensureTokenValid();
          // Update access token after refresh
          this.accessToken = localStorage.getItem('accessToken');
        } catch (refreshError: any) {
          // If refresh fails, clear tokens and throw error
          // This prevents the request from continuing with an invalid token
          this.clearTokens();
          const error = new Error(refreshError.message || 'Your session has expired. Please login again.') as Error & {
            status?: number;
            isAuthError?: boolean;
          };
          error.status = 401;
          error.isAuthError = true;
          throw error;
        }
      } else if (shouldRefreshToken(this.accessToken, 5 * 60 * 1000)) {
        // Token needs refresh but no valid refresh token - clear and throw
        this.clearTokens();
        const error = new Error('Your session has expired. Please login again.') as Error & {
          status?: number;
          isAuthError?: boolean;
        };
        error.status = 401;
        error.isAuthError = true;
        throw error;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Only add Authorization header for non-auth endpoints
    // Auth endpoints (login/register) should not include existing tokens
    if (this.accessToken && !isAuthEndpoint) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET');
    if (needsCsrf && !isAuthEndpoint) {
      let tokenToUse = this.getBestCsrfToken();
      if (!tokenToUse && !this.isCsrfBootstrapEndpoint(endpoint)) {
        tokenToUse = await this.ensureCsrfToken();
      }

      if (tokenToUse) {
        headers['X-CSRF-Token'] = tokenToUse;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for CSRF token
      });
      let responseErrorText: string | null = null;

      // Update CSRF token from response if present
      this.updateCsrfToken(response);

      if (response.status === 403 && retryOnCsrf) {
        responseErrorText = await response.text();
        let errorMessage = 'API request failed';

        try {
          const errorData = JSON.parse(responseErrorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = responseErrorText || errorMessage;
        }

        if (this.isCsrfError(response.status, errorMessage) && !this.isCsrfBootstrapEndpoint(endpoint)) {
          logger.warn('Retrying request after refreshing CSRF token', { endpoint, reason: errorMessage });
          await this.ensureCsrfToken(true);
          return this.request<T>(endpoint, options, retryOn401, false);
        }
      }

      // Handle 401 Unauthorized - try to refresh token (fallback reactive refresh)
      if (response.status === 401 && retryOn401 && !isAuthEndpoint) {
        try {
          // Try to refresh the token using the service
          await tokenRefreshService.refreshToken();
          // Update access token after refresh
          this.accessToken = localStorage.getItem('accessToken');
          // Retry the original request with new token
          return this.request<T>(endpoint, options, false, retryOnCsrf);
        } catch (refreshError: any) {
          // Refresh failed, clear tokens and throw user-friendly error
          this.clearTokens();
          const error = new Error('Your session has expired. Please login again.') as Error & { 
            status?: number;
            isAuthError?: boolean;
          };
          error.status = 401;
          error.isAuthError = true;
          throw error;
        }
      }

      if (!response.ok) {
        const errorText = responseErrorText ?? await response.text();
        let errorMessage = 'API request failed';
        let errorDetails = null;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
          errorDetails = errorData.error || errorData.details;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        // Handle rate limiting specifically
        if (response.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        }
        
        // If 401 and we didn't retry, handle appropriately
        if (response.status === 401) {
          // For auth endpoints (login/register), 401 means invalid credentials
          // Don't overwrite the error message - use what the backend returned
          if (isAuthEndpoint) {
            // For login/register, keep the backend's error message (e.g., "Invalid credentials")
            // Don't clear tokens - user is trying to login
          } else {
            // For other endpoints, 401 means session expired
            this.clearTokens();
            errorMessage = 'Your session has expired. Please login again.';
          }
        }
        
        // Create error with additional metadata
        const error = new Error(errorMessage) as Error & { 
          error?: unknown;
          status?: number;
          isAuthError?: boolean;
          isNetworkError?: boolean;
        };
        error.error = errorDetails;
        error.status = response.status;
        error.isAuthError = response.status === 401;
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('API request failed:', error);
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const networkError = new Error('Cannot connect to backend server. Please make sure the backend is running on http://localhost:3000') as Error & {
          isNetworkError?: boolean;
        };
        networkError.isNetworkError = true;
        throw networkError;
      }
      
      // Re-throw auth errors and other errors
      throw error;
    }
  }

  async get<T>(endpoint: string, options: Omit<RequestInit, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options: Omit<RequestInit, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'POST',
    };

    if (body !== undefined) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return this.request<T>(endpoint, requestOptions);
  }

  // Auth methods
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    if (response.data) {
      this.setAccessToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
      
      // Broadcast login to other tabs
      sessionSyncService.broadcastLogin({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });
    }
    
    return response.data!;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.data) {
      this.setAccessToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
      
      // Broadcast login to other tabs
      sessionSyncService.broadcastLogin({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });
    }
    
    return response.data!;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    
    // Broadcast logout to other tabs before clearing tokens
    sessionSyncService.broadcastLogout();
    
    if (refreshToken) {
      try {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        // Continue with logout even if API call fails
        logger.warn('Logout API call failed, continuing with local logout');
      }
    }
    
    this.clearTokens();
  }

  async sendOtp(identifier: string): Promise<SendOtpResponse> {
    const response = await this.request<SendOtpResponse>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
    return response.data!;
  }

  async verifyOtp(identifier: string, otp: string, name?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp, name }),
    });
    
    if (response.data) {
      this.setAccessToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
      
      // Broadcast login to other tabs
      sessionSyncService.broadcastLogin({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });
    }
    
    return response.data!;
  }

  async refreshAccessToken(): Promise<AuthResponse> {
    // Make direct API call to avoid circular dependency
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseURL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });

    this.updateCsrfToken(response);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to refresh token';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.message || 'Failed to refresh token');
    }

    return data.data;
  }

  // Transaction methods
  async getTransactions(page = 1, limit = 10): Promise<{ data: Transaction[]; pagination: any }> {
    const response = await this.request<{ data: Transaction[]; pagination: any }>(`/transactions?page=${page}&limit=${limit}`);
    return {
      data: response.data || [],
      pagination: response.pagination || {}
    };
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const response = await this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
    return response.data!;
  }

  async updateTransaction(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
    const response = await this.request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    });
    return response.data!;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  async getTransactionAnalytics(period = '30'): Promise<any> {
    const response = await this.request<any>(`/transactions/analytics?period=${period}`);
    return response.data!;
  }

  async searchTransactions(query: string, limit = 10): Promise<any[]> {
    const response = await this.request<any[]>(`/transactions/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data || [];
  }

  // AI methods
  async getAiAdvice(query: string, context?: any): Promise<AiAdvice> {
    try {
      const response = await this.request<AiAdvice>('/ai/advice', {
        method: 'POST',
        body: JSON.stringify({ query, context }),
      });
      return response.data!;
    } catch (error: any) {
      // Check if error is due to missing API key
      if (error.message?.includes('API key') || error.status === 500) {
        throw new Error('AI Advisor requires an OpenAI API key. Please configure OPENAI_API_KEY in the backend .env file.');
      }
      throw error;
    }
  }

  async getAiHistory(limit = 10): Promise<any[]> {
    const response = await this.request<any[]>(`/ai/history?limit=${limit}`);
    return response.data!;
  }

  // Budget methods
  async getBudgets(page = 1, limit = 10, status?: string): Promise<{ data: Budget[]; pagination: any }> {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    
    const response = await this.request<{ data: Budget[]; pagination: any }>(`/budgets?${params}`);
    return {
      data: response.data || [],
      pagination: response.pagination || {}
    };
  }

  async createBudget(budget: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const response = await this.request<Budget>('/budgets', {
      method: 'POST',
      body: JSON.stringify(budget),
    });
    return response.data!;
  }

  async updateBudget(id: string, budget: Partial<Budget>): Promise<Budget> {
    const response = await this.request<Budget>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(budget),
    });
    return response.data!;
  }

  async deleteBudget(id: string): Promise<void> {
    await this.request(`/budgets/${id}`, {
      method: 'DELETE',
    });
  }

  async getBudgetAnalytics(period = '30'): Promise<any> {
    const response = await this.request<any>(`/budgets/analytics?period=${period}`);
    return response.data!;
  }

  // Goal methods
  async getGoals(page = 1, limit = 10, status?: string): Promise<{ data: Goal[]; pagination: any }> {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    
    const response = await this.request<{ data: Goal[]; pagination: any }>(`/goals?${params}`);
    return {
      data: response.data || [],
      pagination: response.pagination || {}
    };
  }

  async createGoal(goal: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const response = await this.request<Goal>('/goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    });
    return response.data!;
  }

  async updateGoal(id: string, goal: Partial<Goal>): Promise<Goal> {
    const response = await this.request<Goal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(goal),
    });
    return response.data!;
  }

  async deleteGoal(id: string): Promise<void> {
    await this.request(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  async getGoalAnalytics(): Promise<any> {
    const response = await this.request<any>('/goals/analytics');
    return response.data!;
  }

  // User profile methods
  async getProfile(): Promise<User> {
    const response = await this.request<User>('/users/profile');
    return response.data!;
  }

  async updateProfile(profile: Partial<User>): Promise<User> {
    const response = await this.request<User>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    return response.data!;
  }

  async uploadAvatar(avatarUrl: string): Promise<User> {
    const response = await this.request<User>('/users/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatarUrl }),
    });
    return response.data!;
  }

  async deleteAvatar(): Promise<User> {
    const response = await this.request<User>('/users/avatar', {
      method: 'DELETE',
    });
    return response.data!;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getUserStats(): Promise<any> {
    const response = await this.request<any>('/users/stats');
    return response.data!;
  }

  // Settings methods
  async getSettings(): Promise<any> {
    const response = await this.request<any>('/settings');
    return response.data!;
  }

  async updateSettings(section: string, settings: any): Promise<any> {
    const response = await this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ section, settings }),
    });
    return response.data!;
  }

  async getPreferences(): Promise<any> {
    const response = await this.request<any>('/settings/preferences');
    return response.data!;
  }

  async updatePreferences(preferences: any): Promise<any> {
    const response = await this.request<any>('/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
    return response.data!;
  }

  async getNotificationSettings(): Promise<any> {
    const response = await this.request<any>('/settings/notifications');
    return response.data!;
  }

  async updateNotificationSettings(notifications: any): Promise<any> {
    const response = await this.request<any>('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(notifications),
    });
    return response.data!;
  }

  // Health check
  async healthCheck(): Promise<any> {
    const response = await this.request<any>('/health');
    return response.data!;
  }

  // Development utility to reset rate limits
  async resetRateLimit(): Promise<void> {
    // Only available in development
    if (env.NODE_ENV !== 'development') {
      return;
    }
    try {
      await fetch(`${this.baseURL.replace('/api/v1', '')}/reset-rate-limit`, {
        method: 'POST',
      });
    } catch (error) {
      logger.warn('Could not reset rate limit');
    }
  }

  // Token management
  setAccessToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem('accessToken', token);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token);
  }

  clearTokens(): void {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    logger.info('Tokens cleared');
  }

  // Utility method to clear tokens from browser console
  static clearAllTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    logger.info('All tokens cleared');
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
