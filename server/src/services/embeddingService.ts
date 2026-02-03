import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import OpenAI from 'openai';

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor() {
    if (config.OPENAI_API_KEY && config.OPENAI_API_KEY !== '') {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generate embedding for a text using OpenAI
   * @param text - Text to embed
   * @param useCache - Whether to use cache for repeated queries
   * @returns Embedding vector (1536 dimensions)
   */
  async generateEmbedding(text: string, useCache: boolean = true): Promise<number[]> {
    if (!this.openai) {
      throw new AppError('OpenAI API not configured', 500);
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (useCache && this.embeddingCache.has(cacheKey)) {
      logger.debug('Embedding cache hit', { textLength: text.length });
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;

      // Cache the embedding
      if (useCache) {
        this.embeddingCache.set(cacheKey, embedding);
        
        // Limit cache size to 1000 entries
        if (this.embeddingCache.size > 1000) {
          const firstKey = this.embeddingCache.keys().next().value;
          if (firstKey) {
            this.embeddingCache.delete(firstKey);
          }
        }
      }

      logger.debug('Embedding generated', { 
        textLength: text.length,
        dimensions: embedding.length 
      });

      return embedding;
    } catch (error: any) {
      logger.error('Failed to generate embedding:', error);
      throw new AppError('Failed to generate embedding', 500);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new AppError('OpenAI API not configured', 500);
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      });

      const embeddings = response.data.map(item => item.embedding);

      logger.info('Batch embeddings generated', { 
        count: texts.length,
        dimensions: embeddings[0]?.length || 0
      });

      return embeddings;
    } catch (error: any) {
      logger.error('Failed to generate batch embeddings:', error);
      throw new AppError('Failed to generate embeddings', 500);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score (0-1)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

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
}


