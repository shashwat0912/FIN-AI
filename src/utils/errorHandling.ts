/**
 * Error Handling Utilities
 * Provides consistent error handling patterns across the application
 */

import { ApiError } from '../types';

/**
 * Creates a standardized API error
 */
export function createApiError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: Record<string, unknown>
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof (error as ApiError).statusCode === 'number'
  );
}

/**
 * Extracts error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
}

/**
 * Extracts error details for logging
 */
export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (isApiError(error)) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  
  return {
    message: 'Unknown error',
    type: typeof error,
    value: error,
  };
}

/**
 * Common error messages
 */
export const ErrorMessages = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'An internal server error occurred. Please try again later.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  TIMEOUT: 'Request timed out. Please try again.',
} as const;

/**
 * Maps HTTP status codes to user-friendly messages
 */
export function getStatusMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return ErrorMessages.VALIDATION_ERROR;
    case 401:
      return ErrorMessages.UNAUTHORIZED;
    case 403:
      return ErrorMessages.FORBIDDEN;
    case 404:
      return ErrorMessages.NOT_FOUND;
    case 429:
      return ErrorMessages.RATE_LIMITED;
    case 500:
    case 502:
    case 503:
    case 504:
      return ErrorMessages.SERVER_ERROR;
    default:
      return ErrorMessages.SERVER_ERROR;
  }
}

/**
 * Handles API errors with consistent formatting
 */
export function handleApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return createApiError(error.message, 500, 'INTERNAL_ERROR');
  }
  
  return createApiError(ErrorMessages.SERVER_ERROR, 500, 'UNKNOWN_ERROR');
}

/**
 * Error boundary helper for React components
 */
export function createErrorState(error: unknown): {
  hasError: boolean;
  error: ApiError | null;
  message: string;
  retry: () => void;
} {
  const apiError = handleApiError(error);
  
  return {
    hasError: true,
    error: apiError,
    message: getStatusMessage(apiError.statusCode || 500),
    retry: () => {
      // This will be implemented by the component using this helper
      window.location.reload();
    },
  };
}

/**
 * Async error wrapper for API calls
 */
export async function withErrorHandling<T>(
  apiCall: () => Promise<T>,
  context?: string
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const data = await apiCall();
    return { data, error: null };
  } catch (err) {
    const error = handleApiError(err);
    if (context) {
      error.details = { ...error.details, context };
    }
    return { data: null, error };
  }
}













