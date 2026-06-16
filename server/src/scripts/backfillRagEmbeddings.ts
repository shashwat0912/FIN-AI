import prisma from '../config/database';
import logger from '../config/logger';
import { EmbeddingService } from '../services/embeddingService';

const BATCH_SIZE = 100;

async function backfillRagEmbeddings() {
  const embeddingService = new EmbeddingService();
  let processed = 0;

  logger.info('Starting RAG embedding backfill', {
    embeddingMode: embeddingService.getMode(),
  });

  while (true) {
    const chunks = await prisma.ragChunk.findMany({
      where: { embedding: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        content: true,
      },
    });

    if (chunks.length === 0) {
      break;
    }

    const embeddings = await embeddingService.generateEmbeddings(chunks.map((chunk) => chunk.content));

    await prisma.$transaction(
      chunks.map((chunk, idx) =>
        prisma.ragChunk.update({
          where: { id: chunk.id },
          data: { embedding: JSON.stringify(embeddings[idx]) },
        })
      )
    );

    processed += chunks.length;
    logger.info('Backfilled RAG chunk embeddings batch', {
      batchSize: chunks.length,
      processed,
    });
  }

  logger.info('RAG embedding backfill completed', { processed });
}

if (require.main === module) {
  backfillRagEmbeddings()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('RAG embedding backfill failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      process.exit(1);
    });
}

export default backfillRagEmbeddings;
