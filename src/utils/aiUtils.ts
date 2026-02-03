import { AiResponse } from '../hooks/useAiAdvice';

export const generatePrompt = (query: string, context: any): string => {
  const basePrompt = `As a financial advisor, considering the following context:
- Monthly Income: ₹${context.monthlyIncome}
- Monthly Savings: ₹${context.monthlySavings}
- Current Investments: ₹${context.currentInvestments}
- Age: ${context.age}
- Has Health Insurance: ${context.hasHealthInsurance}

Question: ${query}

Please provide specific, actionable advice in the Indian context, considering local financial products and regulations.`;

  return basePrompt;
};

export const categorizeAdvice = (content: string): AiResponse['type'] => {
  const keywords = {
    investment: ['invest', 'stock', 'mutual fund', 'equity', 'bond', 'portfolio'],
    insurance: ['insurance', 'coverage', 'policy', 'risk', 'term'],
    budget: ['budget', 'spend', 'expense', 'cost', 'saving'],
    savings: ['save', 'deposit', 'fd', 'emergency fund']
  };

  const contentLower = content.toLowerCase();
  
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => contentLower.includes(word))) {
      return category as AiResponse['type'];
    }
  }

  return 'savings';
};