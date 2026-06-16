import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { EmbeddingService } from './embeddingService';

export interface KnowledgeChunk {
  content: string;
  category: string;
  source?: string;
  metadata?: Record<string, any>;
}

export class KnowledgeBaseService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Add a single knowledge chunk to the database
   * @param chunk - Knowledge chunk to add
   * @returns Created chunk ID
   */
  async addChunk(chunk: KnowledgeChunk): Promise<string> {
    try {
      // Generate embedding for the content
      const embedding = await this.embeddingService.generateEmbedding(chunk.content, false);
      const embeddingStr = `[${embedding.join(',')}]`;

      // Store in database using raw SQL to handle vector type
      const result = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        INSERT INTO knowledge_chunks (id, content, category, source, metadata, embedding, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4::jsonb,
          $5::vector,
          NOW(),
          NOW()
        )
        RETURNING id
      `, chunk.content, chunk.category, chunk.source || null, JSON.stringify(chunk.metadata || {}), embeddingStr);

      const chunkId = result[0].id;

      logger.info('Knowledge chunk added', {
        id: chunkId,
        category: chunk.category,
        contentLength: chunk.content.length,
      });

      return chunkId;
    } catch (error: any) {
      logger.error('Failed to add knowledge chunk:', error);
      throw new AppError('Failed to add knowledge chunk', 500);
    }
  }

  /**
   * Add multiple knowledge chunks in batch
   * @param chunks - Array of knowledge chunks
   * @returns Array of created chunk IDs
   */
  async addChunks(chunks: KnowledgeChunk[]): Promise<string[]> {
    const chunkIds: string[] = [];

    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

      for (const chunk of batch) {
        try {
          const id = await this.addChunk(chunk);
          chunkIds.push(id);
        } catch (error) {
          logger.error('Failed to add chunk in batch:', error);
          // Continue with other chunks even if one fails
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Batch processing completed', {
      total: chunks.length,
      successful: chunkIds.length,
      failed: chunks.length - chunkIds.length,
    });

    return chunkIds;
  }

  /**
   * Update an existing knowledge chunk
   * @param id - Chunk ID
   * @param chunk - Updated chunk data
   */
  async updateChunk(id: string, chunk: Partial<KnowledgeChunk>): Promise<void> {
    try {
      // If content is being updated, regenerate embedding
      let embeddingStr: string | undefined;
      if (chunk.content) {
        const embedding = await this.embeddingService.generateEmbedding(chunk.content, false);
        embeddingStr = `[${embedding.join(',')}]`;
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (chunk.content) {
        updates.push(`content = $${paramIndex++}`);
        values.push(chunk.content);
      }
      if (chunk.category) {
        updates.push(`category = $${paramIndex++}`);
        values.push(chunk.category);
      }
      if (chunk.source !== undefined) {
        updates.push(`source = $${paramIndex++}`);
        values.push(chunk.source);
      }
      if (chunk.metadata) {
        updates.push(`metadata = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(chunk.metadata));
      }
      if (embeddingStr) {
        updates.push(`embedding = $${paramIndex++}::vector`);
        values.push(embeddingStr);
      }

      updates.push(`"updatedAt" = NOW()`);

      if (updates.length === 0) {
        return;
      }

      values.push(id);

      await prisma.$executeRawUnsafe(`
        UPDATE knowledge_chunks
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
      `, ...values);

      logger.info('Knowledge chunk updated', { id, fields: Object.keys(chunk) });
    } catch (error: any) {
      logger.error('Failed to update knowledge chunk:', error);
      throw new AppError('Failed to update knowledge chunk', 500);
    }
  }

  /**
   * Delete a knowledge chunk
   * @param id - Chunk ID
   */
  async deleteChunk(id: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM knowledge_chunks
        WHERE id = $1
      `, id);

      logger.info('Knowledge chunk deleted', { id });
    } catch (error: any) {
      logger.error('Failed to delete knowledge chunk:', error);
      throw new AppError('Failed to delete knowledge chunk', 500);
    }
  }

  /**
   * Get all chunks in a category
   * @param category - Category to filter by
   * @returns Array of chunks
   */
  async getChunksByCategory(category: string): Promise<Array<{
    id: string;
    content: string;
    category: string;
    source: string | null;
  }>> {
    try {
      const chunks = await prisma.$queryRawUnsafe<Array<{
        id: string;
        content: string;
        category: string;
        source: string | null;
      }>>(`
        SELECT id, content, category, source
        FROM knowledge_chunks
        WHERE category = $1
        ORDER BY "createdAt" DESC
      `, category);

      return chunks;
    } catch (error: any) {
      logger.error('Failed to get chunks by category:', error);
      throw new AppError('Failed to retrieve knowledge chunks', 500);
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<{
    totalChunks: number;
    categories: Array<{ category: string; count: number }>;
  }> {
    try {
      const totalResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT COUNT(*) as count
        FROM knowledge_chunks
      `);

      const categoriesResult = await prisma.$queryRawUnsafe<Array<{ category: string; count: bigint }>>(`
        SELECT category, COUNT(*) as count
        FROM knowledge_chunks
        GROUP BY category
        ORDER BY count DESC
      `);

      return {
        totalChunks: Number(totalResult[0].count),
        categories: categoriesResult.map(c => ({
          category: c.category,
          count: Number(c.count),
        })),
      };
    } catch (error: any) {
      logger.error('Failed to get knowledge base stats:', error);
      throw new AppError('Failed to get statistics', 500);
    }
  }

  /**
   * Chunk long text into smaller pieces
   * @param text - Text to chunk
   * @param chunkSize - Size of each chunk (in words)
   * @param overlap - Overlap between chunks (in words)
   * @returns Array of text chunks
   */
  chunkText(text: string, chunkSize: number = 300, overlap: number = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }
}


