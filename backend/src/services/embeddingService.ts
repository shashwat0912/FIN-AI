import { config } from '../config/env';
import logger from '../config/logger';
import OpenAI from 'openai';
import { hasUsableOpenAiKey } from '../config/openai';

type EmbeddingMode = 'openai' | 'local';

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private temporarilyDisabled = false;
  private mode: EmbeddingMode = 'local';
  private readonly localEmbeddingDims = 256;

  constructor() {
    const provider = (config.EMBEDDING_PROVIDER || config.AI_PROVIDER || 'auto').toLowerCase();
    const wantsOpenAi = provider === 'openai' || provider === 'auto';
    const hasOpenAiKey = hasUsableOpenAiKey(config.OPENAI_API_KEY);

    if (wantsOpenAi && hasOpenAiKey) {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
        timeout: config.OPENAI_TIMEOUT_MS,
      });
      this.mode = 'openai';
      return;
    }

    this.mode = 'local';
  }

  isConfigured(): boolean {
    // Local mode always has a deterministic embedding fallback.
    return true;
  }

  isUsingOpenAI(): boolean {
    return this.mode === 'openai' && this.openai !== null && !this.temporarilyDisabled;
  }

  getMode(): EmbeddingMode {
    return this.isUsingOpenAI() ? 'openai' : 'local';
  }

  /**
   * Generate embedding for a text using OpenAI
   * @param text - Text to embed
   * @param useCache - Whether to use cache for repeated queries
   * @returns Embedding vector (1536 dimensions)
   */
  async generateEmbedding(text: string, useCache: boolean = true): Promise<number[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (useCache && this.embeddingCache.has(cacheKey)) {
      logger.debug('Embedding cache hit', { textLength: text.length });
      return this.embeddingCache.get(cacheKey)!;
    }

    let embedding: number[];

    if (this.isUsingOpenAI()) {
      try {
        const response = await this.openai!.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
        });
        embedding = response.data[0].embedding;
      } catch (error: any) {
        this.temporarilyDisabled = true;
        logger.warn('OpenAI embeddings unavailable. Falling back to local deterministic embeddings.', {
          error: error?.message || 'unknown',
        });
        embedding = this.generateLocalEmbedding(text);
      }
    } else {
      embedding = this.generateLocalEmbedding(text);
    }

    if (useCache) {
      this.cacheEmbedding(cacheKey, embedding);
    }

    logger.debug('Embedding generated', {
      textLength: text.length,
      dimensions: embedding.length,
      mode: this.getMode(),
    });

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (this.isUsingOpenAI()) {
      try {
        const response = await this.openai!.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
          encoding_format: 'float',
        });

        const embeddings = response.data.map((item) => item.embedding);
        logger.info('Batch embeddings generated with OpenAI', {
          count: texts.length,
          dimensions: embeddings[0]?.length || 0,
        });
        return embeddings;
      } catch (error: any) {
        this.temporarilyDisabled = true;
        logger.warn('OpenAI batch embeddings failed. Using local deterministic embeddings.', {
          error: error?.message || 'unknown',
        });
      }
    }

    return texts.map((text) => this.generateLocalEmbedding(text));
  }

  async generateEmbeddingsSafely(texts: string[]): Promise<(number[] | null)[]> {
    try {
      const embeddings = await this.generateEmbeddings(texts);
      return embeddings;
    } catch (error: any) {
      logger.error('Embedding generation failed unexpectedly', {
        error: error?.message || 'unknown',
      });
      // Hard fallback path: still keep retrieval functional.
      return texts.map((text) => this.generateLocalEmbedding(text));
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score (0-1)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    const dimension = Math.min(a.length, b.length);
    if (dimension === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < dimension; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    logger.info('Embedding cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.embeddingCache.size,
      maxSize: 1000,
    };
  }

  private getCacheKey(text: string): string {
    // Use first 100 chars as cache key (good enough for most cases)
    return text.substring(0, 100).toLowerCase().trim();
  }

  private cacheEmbedding(cacheKey: string, embedding: number[]): void {
    this.embeddingCache.set(cacheKey, embedding);

    if (this.embeddingCache.size > 1000) {
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) {
        this.embeddingCache.delete(firstKey);
      }
    }
  }

  private generateLocalEmbedding(text: string): number[] {
    const vector = new Array(this.localEmbeddingDims).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = normalized.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      return vector;
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const unigramHash = this.hashToken(token);
      const unigramIndex = unigramHash % this.localEmbeddingDims;
      const unigramSign = (unigramHash & 1) === 0 ? 1 : -1;
      vector[unigramIndex] += unigramSign * (1 + Math.min(token.length, 12) / 12);

      if (i < tokens.length - 1) {
        const bi = `${token}_${tokens[i + 1]}`;
        const biHash = this.hashToken(bi);
        const biIndex = biHash % this.localEmbeddingDims;
        const biSign = (biHash & 1) === 0 ? 1 : -1;
        vector[biIndex] += biSign * 0.75;
      }
    }

    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) return vector;

    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }

  private hashToken(token: string): number {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }
}
