/**
 * API Utility Functions
 * Common patterns and utilities for API interactions
 */

import { ApiResponse, ApiError } from '../types';
import { logger } from './logger';
import { handleApiError, withErrorHandling } from './errorHandling';

/**
 * Generic API hook state
 */
export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Generic API hook actions
 */
export interface ApiActions {
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Complete API hook return type
 */
export type UseApiReturn<T> = ApiState<T> & ApiActions;

/**
 * Creates a standardized API state
 */
export function createApiState<T>(initialData: T | null = null): ApiState<T> {
  return {
    data: initialData,
    loading: false,
    error: null,
  };
}

/**
 * Generic API call wrapper with error handling
 */
export async function apiCall<T>(
  apiFunction: () => Promise<T>,
  context: string
): Promise<{ data: T | null; error: ApiError | null }> {
  return withErrorHandling(apiFunction, context);
}

/**
 * Generic hook for API calls with loading states
 */
export function createApiHook<T>(
  apiFunction: () => Promise<T>,
  context: string
) {
  return {
    async execute(): Promise<{ data: T | null; error: ApiError | null }> {
      return apiCall(apiFunction, context);
    },
  };
}

/**
 * Retry mechanism for failed API calls
 */
export async function retryApiCall<T>(
  apiFunction: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  context: string = 'apiCall'
): Promise<{ data: T | null; error: ApiError | null }> {
  let lastError: ApiError | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await apiCall(apiFunction, context);
    
    if (!error) {
      return { data, error: null };
    }
    
    lastError = error;
    
    // Don't retry on client errors (4xx)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      break;
    }
    
    if (attempt < maxRetries) {
      logger.warn(`API call failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
        context,
        error: error.message,
        attempt,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  logger.error(`API call failed after ${maxRetries} attempts`, lastError, { context });
  return { data: null, error: lastError };
}

/**
 * Debounced API call to prevent excessive requests
 */
export function createDebouncedApiCall<T>(
  apiFunction: () => Promise<T>,
  delay: number = 300,
  context: string = 'debouncedApiCall'
) {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return {
    execute: (): Promise<{ data: T | null; error: ApiError | null }> => {
      return new Promise((resolve) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(async () => {
          const result = await apiCall(apiFunction, context);
          resolve(result);
        }, delay);
      });
    },
    
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}

/**
 * Batch API calls for multiple requests
 */
export async function batchApiCalls<T>(
  apiFunctions: Array<() => Promise<T>>,
  context: string = 'batchApiCalls'
): Promise<Array<{ data: T | null; error: ApiError | null }>> {
  const promises = apiFunctions.map((apiFunction, index) =>
    apiCall(apiFunction, `${context}[${index}]`)
  );
  
  return Promise.all(promises);
}

/**
 * Cache for API responses
 */
class ApiCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
}

export const apiCache = new ApiCache();

/**
 * Cached API call
 */
export async function cachedApiCall<T>(
  key: string,
  apiFunction: () => Promise<T>,
  ttl: number = 5 * 60 * 1000,
  context: string = 'cachedApiCall'
): Promise<{ data: T | null; error: ApiError | null }> {
  // Try cache first
  const cached = apiCache.get<T>(key);
  if (cached) {
    logger.debug(`Cache hit for ${key}`, { context });
    return { data: cached, error: null };
  }
  
  // Make API call
  const { data, error } = await apiCall(apiFunction, context);
  
  // Cache successful results
  if (data && !error) {
    apiCache.set(key, data, ttl);
    logger.debug(`Cached result for ${key}`, { context });
  }
  
  return { data, error };
}













