/**
 * @deprecated This file is deprecated. OpenAI API calls are now handled by the backend.
 * Use apiClient.getAiAdvice() instead to prevent API key exposure in the frontend.
 * 
 * This file is kept for backward compatibility but should not be used in production.
 */

import { logger } from '../utils/logger';

// Re-export types for backward compatibility
export type { AiResponse } from '../hooks/useAiAdvice';

/**
 * @deprecated Use apiClient.getAiAdvice() instead
 */
export const getFinancialAdvice = async (
  query: string,
  financialContext: any
): Promise<any> => {
  logger.warn('getFinancialAdvice from lib/openai.ts is deprecated. Use apiClient.getAiAdvice() instead.');
  throw new Error('Direct OpenAI calls are disabled. Please use the backend API via apiClient.getAiAdvice()');
};