import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database', () => ({
  default: {
    ragDocument: {
      findUnique: vi.fn(),
    },
    ragChunk: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/services/embeddingService', () => ({
  EmbeddingService: class {
    isConfigured() {
      return false;
    }
    isUsingOpenAI() {
      return false;
    }
    getMode() {
      return 'local';
    }
    async generateEmbeddingsSafely(texts: string[]) {
      return texts.map(() => null);
    }
    async generateEmbedding() {
      return [0.1, 0.2];
    }
    cosineSimilarity() {
      return 0.9;
    }
  },
}));

import prisma from '../../src/config/database';
import { RAGService } from '../../src/services/ragService';

describe('RAGService retrieval fallback', () => {
  let ragService: RAGService;

  beforeEach(() => {
    ragService = new RAGService();
    vi.clearAllMocks();
  });

  it('returns category-relevant chunk via keyword fallback when embeddings are unavailable', async () => {
    vi.mocked(prisma.ragChunk.findMany).mockResolvedValue([
      {
        id: 'c1',
        content: 'Section 80C allows deduction up to 1.5 lakh for ELSS and PPF.',
        category: 'tax_planning',
        embedding: null,
        document: { title: 'Tax Guide', sourceUri: 'seed://tax', sourceType: 'knowledge_base' },
      },
      {
        id: 'c2',
        content: 'Nifty index funds are good for long-term equity investing.',
        category: 'investment',
        embedding: null,
        document: { title: 'Investment Guide', sourceUri: 'seed://invest', sourceType: 'knowledge_base' },
      },
    ] as any);

    const result = await ragService.retrieveContext('How can I save tax under 80C?', {
      topK: 1,
      similarityThreshold: 0.05,
    });

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('tax_planning');
    expect(result[0].similarity).toBeGreaterThan(0);
  });
});
