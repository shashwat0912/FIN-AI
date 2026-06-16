import logger from '../config/logger';
import { indianFinanceKnowledge } from '../data/financeKnowledge';
import { RAGService, RagDocumentInput } from '../services/ragService';

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function indexRagKnowledge() {
  const ragService = new RAGService();

  const documents: RagDocumentInput[] = indianFinanceKnowledge.map((entry, index) => ({
    title: `${entry.category.toUpperCase()} knowledge ${index + 1}`,
    content: entry.content,
    sourceType: 'knowledge_base',
    sourceUri: entry.source ? `seed://${toSlug(entry.source)}` : `seed://finance-knowledge-${index + 1}`,
    jurisdiction: 'india',
    language: 'en',
    category: entry.category,
    metadata: {
      source: entry.source || 'internal_seed',
      category: entry.category,
      seededAt: new Date().toISOString(),
    },
    overwriteExisting: true,
  }));

  logger.info('Starting RAG knowledge indexing', {
    totalDocuments: documents.length,
  });

  const results = await ragService.bulkIndexDocuments(documents);
  const indexed = results.filter((result) => !result.skipped).length;
  const skipped = results.filter((result) => result.skipped).length;
  const chunks = results.reduce((sum, result) => sum + result.chunkCount, 0);

  logger.info('RAG knowledge indexing completed', {
    indexed,
    skipped,
    totalDocuments: results.length,
    totalChunks: chunks,
  });
}

if (require.main === module) {
  indexRagKnowledge()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('RAG indexing failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      process.exit(1);
    });
}

export default indexRagKnowledge;

