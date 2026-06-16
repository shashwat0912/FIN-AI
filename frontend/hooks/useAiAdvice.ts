import { useState } from 'react';
import { apiClient } from '../lib/api';
import { logger } from '../utils/logger';

export interface AiResponse {
  type: 'savings' | 'investment' | 'insurance' | 'budget';
  title: string;
  description: string;
}

interface FinancialContext {
  monthlyIncome: number;
  monthlySavings: number;
  currentInvestments: number;
  age: number;
  hasHealthInsurance: boolean;
}

export function useAiAdvice() {
  const [suggestions, setSuggestions] = useState<AiResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const financialContext: FinancialContext = {
    monthlyIncome: 5000,
    monthlySavings: 850,
    currentInvestments: 2150,
    age: 30,
    hasHealthInsurance: false
  };

  const getAdvice = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      // Use backend API instead of direct OpenAI call
      const response = await apiClient.getAiAdvice(query, {
        monthlyIncome: financialContext.monthlyIncome,
        monthlyExpenses: financialContext.monthlyIncome - financialContext.monthlySavings,
        currentBalance: financialContext.currentInvestments,
      });
      
      if (response) {
        const aiResponse: AiResponse = {
          type: mapCategoryToType(response.category),
          title: query,
          description: response.advice,
        };
        setSuggestions(prev => [aiResponse, ...prev]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI advice';
      setError(errorMessage);
      logger.error('Failed to get AI advice:', err);
    } finally {
      setLoading(false);
    }
  };

  return { suggestions, loading, error, getAdvice };
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