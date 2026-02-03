import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { EmbeddingService } from './embeddingService';

export interface RetrievedChunk {
  id: string;
  content: string;
  category: string;
  source?: string;
  similarity: number;
}

export interface RAGConfig {
  topK?: number;
  similarityThreshold?: number;
  categories?: string[];
}

export class RAGService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Retrieve relevant knowledge chunks for a query
   * @param query - User's question
   * @param config - Retrieval configuration
   * @returns Array of relevant knowledge chunks
   */
  async retrieveContext(query: string, config?: RAGConfig): Promise<RetrievedChunk[]> {
    const topK = config?.topK || 5;
    const similarityThreshold = config?.similarityThreshold || 0.7;

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Convert embedding to PostgreSQL vector format
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Build category filter if specified
      const categoryFilter = config?.categories && config.categories.length > 0
        ? `AND category = ANY(ARRAY[${config.categories.map(c => `'${c}'`).join(',')}]::text[])`
        : '';

      // Perform vector similarity search using cosine distance
      const result = await prisma.$queryRawUnsafe<Array<{
        id: string;
        content: string;
        category: string;
        source: string | null;
        similarity: number;
      }>>(`
        SELECT 
          id,
          content,
          category,
          source,
          1 - (embedding <=> $1::vector) as similarity
        FROM knowledge_chunks
        WHERE 1 - (embedding <=> $1::vector) > $2
        ${categoryFilter}
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `, embeddingStr, similarityThreshold, topK);

      logger.info('RAG retrieval completed', {
        query: query.substring(0, 50),
        retrieved: result.length,
        topSimilarity: result[0]?.similarity || 0,
      });

      return result.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        category: chunk.category,
        source: chunk.source || undefined,
        similarity: chunk.similarity,
      }));
    } catch (error: any) {
      logger.error('RAG retrieval failed:', error);
      // Don't throw - return empty array so AI can still generate response
      return [];
    }
  }

  /**
   * Format retrieved chunks for prompt injection
   * @param chunks - Retrieved knowledge chunks
   * @returns Formatted context string
   */
  formatContextForPrompt(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    let context = '\nRelevant Financial Knowledge:\n';
    
    chunks.forEach((chunk, index) => {
      context += `\n${index + 1}. ${chunk.content}`;
      if (chunk.source) {
        context += ` (Source: ${chunk.source})`;
      }
    });

    context += '\n\nBased on the above knowledge and the user\'s financial context, provide personalized advice.\n';

    return context;
  }

  /**
   * Hybrid search: Combine semantic search with keyword matching
   * @param query - User's question
   * @param config - Retrieval configuration
   * @returns Array of relevant knowledge chunks
   */
  async hybridSearch(query: string, config?: RAGConfig): Promise<RetrievedChunk[]> {
    const topK = config?.topK || 5;
    const similarityThreshold = config?.similarityThreshold || 0.7;

    try {
      // Generate embedding for semantic search
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Extract keywords for keyword search
      const keywords = this.extractKeywords(query);
      const keywordPattern = keywords.map(k => `%${k}%`).join('|');

      // Build category filter
      const categoryFilter = config?.categories && config.categories.length > 0
        ? `AND category = ANY(ARRAY[${config.categories.map(c => `'${c}'`).join(',')}]::text[])`
        : '';

      // Hybrid search: semantic + keyword matching
      const result = await prisma.$queryRawUnsafe<Array<{
        id: string;
        content: string;
        category: string;
        source: string | null;
        similarity: number;
      }>>(`
        SELECT 
          id,
          content,
          category,
          source,
          (1 - (embedding <=> $1::vector)) * 0.7 + 
          CASE WHEN content ~* $2 THEN 0.3 ELSE 0 END as similarity
        FROM knowledge_chunks
        WHERE 1 - (embedding <=> $1::vector) > $3
        ${categoryFilter}
        ORDER BY similarity DESC
        LIMIT $4
      `, embeddingStr, keywordPattern, similarityThreshold * 0.7, topK);

      logger.info('Hybrid search completed', {
        query: query.substring(0, 50),
        keywords: keywords.join(', '),
        retrieved: result.length,
      });

      return result.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        category: chunk.category,
        source: chunk.source || undefined,
        similarity: chunk.similarity,
      }));
    } catch (error: any) {
      logger.error('Hybrid search failed:', error);
      // Fallback to regular retrieval
      return this.retrieveContext(query, config);
    }
  }

  /**
   * Extract keywords from query for hybrid search
   */
  private extractKeywords(query: string): string[] {
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'about', 'how', 'what', 'when', 'where', 'why', 'should', 'can', 'could', 'will', 'would'];
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 5); // Limit to 5 keywords
  }
}


