import { useState } from 'react';
import { apiClient, AiAdvice } from '../lib/api';
import { AiResponse, TransactionContext, ApiError } from '../types';
import { logger } from '../utils/logger';
import { handleApiError, withErrorHandling } from '../utils/errorHandling';

interface AiHistoryItem {
  id: string;
  query: string;
  response: string;
  category: string;
  createdAt: string;
}

export function useBackendAi() {
  const [suggestions, setSuggestions] = useState<AiResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const getAdvice = async (query: string, context?: TransactionContext): Promise<void> => {
    setLoading(true);
    setError(null);

    const { data, error } = await withErrorHandling(
      () => apiClient.getAiAdvice(query, context),
      'getAiAdvice'
    );

    if (error) {
      setError(error);
      logger.apiError('getAiAdvice', error, { query, context });
      setLoading(false);
      return;
    }

    if (data) {
      // Convert backend response to frontend format
      const aiResponse: AiResponse = {
        type: mapCategoryToType(data.category),
        title: query,
        description: data.advice,
      };

      setSuggestions(prev => [aiResponse, ...prev]);
    }

    setLoading(false);
  };

  const getHistory = async (limit = 10): Promise<void> => {
    const { data, error } = await withErrorHandling(
      () => apiClient.getAiHistory(limit),
      'getAiHistory'
    );

    if (error) {
      setError(error);
      logger.apiError('getAiHistory', error, { limit });
      return;
    }

    if (data) {
      // Convert history to suggestions format
      const formattedHistory: AiResponse[] = data.map((item: AiHistoryItem) => ({
        type: mapCategoryToType(item.category),
        title: item.query,
        description: item.response,
      }));
      setSuggestions(formattedHistory);
    }
  };

  const clearSuggestions = () => {
    setSuggestions([]);
  };

  return {
    suggestions,
    loading,
    error,
    getAdvice,
    getHistory,
    clearSuggestions,
  };
}

// Helper function to map backend categories to frontend types
function mapCategoryToType(category: string): 'savings' | 'investment' | 'insurance' | 'budget' {
  switch (category) {
    case 'budgeting':
      return 'budget';
    case 'investment':
      return 'investment';
    case 'savings':
      return 'savings';
    case 'debt_management':
      return 'budget';
    case 'retirement':
      return 'investment';
    default:
      return 'budget';
  }
}
