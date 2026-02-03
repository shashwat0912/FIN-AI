/**
 * RAG (Retrieval-Augmented Generation) Configuration
 * Tunable parameters for optimal retrieval and response quality
 */

export const ragConfig = {
  // Retrieval Parameters
  retrieval: {
    topK: 3, // Number of knowledge chunks to retrieve
    similarityThreshold: 0.7, // Minimum similarity score (0-1)
    maxChunkLength: 500, // Maximum words per chunk
    chunkOverlap: 50, // Overlap between chunks in words
  },

  // Embedding Configuration
  embedding: {
    model: 'text-embedding-3-small', // OpenAI embedding model
    dimensions: 1536, // Embedding dimensions
    cacheSize: 1000, // Number of embeddings to cache
  },

  // Prompt Engineering
  prompts: {
    systemPrompt: 'You are an expert Indian financial advisor with deep knowledge of RBI regulations, Indian tax laws, and local investment options. Provide concise, actionable advice tailored to Indian financial markets. Keep responses under 200 characters while being specific and practical.',
    
    maxTokens: 500, // Maximum tokens in response
    temperature: 0.7, // Creativity level (0-2)
    
    // Response length constraints
    minResponseLength: 50, // Minimum characters
    maxResponseLength: 200, // Maximum characters
  },

  // Performance Tuning
  performance: {
    batchSize: 10, // Chunks to process in parallel
    timeoutMs: 30000, // Request timeout (30 seconds)
    retryAttempts: 2, // Number of retries on failure
  },

  // Category-Specific Configuration
  categoryConfig: {
    budgeting: {
      topK: 3,
      similarityThreshold: 0.75,
      keywords: ['budget', 'expense', 'spending', 'income', 'savings'],
    },
    investment: {
      topK: 4,
      similarityThreshold: 0.7,
      keywords: ['invest', 'stock', 'mutual fund', 'equity', 'portfolio'],
    },
    tax_planning: {
      topK: 3,
      similarityThreshold: 0.8, // Higher threshold for tax advice
      keywords: ['tax', '80c', 'deduction', 'exemption', 'income tax'],
    },
    debt_management: {
      topK: 3,
      similarityThreshold: 0.75,
      keywords: ['debt', 'loan', 'emi', 'interest', 'credit'],
    },
    savings: {
      topK: 3,
      similarityThreshold: 0.7,
      keywords: ['save', 'fd', 'deposit', 'emergency', 'fund'],
    },
    retirement: {
      topK: 4,
      similarityThreshold: 0.7,
      keywords: ['retirement', 'pension', 'pf', 'epf', 'nps'],
    },
    insurance: {
      topK: 3,
      similarityThreshold: 0.75,
      keywords: ['insurance', 'health', 'term', 'life', 'cover'],
    },
  },
};

/**
 * Get category-specific RAG configuration
 */
export function getCategoryConfig(category: string) {
  return ragConfig.categoryConfig[category as keyof typeof ragConfig.categoryConfig] || {
    topK: ragConfig.retrieval.topK,
    similarityThreshold: ragConfig.retrieval.similarityThreshold,
    keywords: [],
  };
}


