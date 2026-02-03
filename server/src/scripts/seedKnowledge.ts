import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { indianFinanceKnowledge } from '../data/financeKnowledge';
import logger from '../config/logger';

/**
 * Seed the knowledge base with Indian finance content
 */
async function seedKnowledgeBase() {
  const knowledgeBaseService = new KnowledgeBaseService();

  try {
    logger.info('Starting knowledge base seeding...');
    logger.info(`Total chunks to add: ${indianFinanceKnowledge.length}`);

    // Add all knowledge chunks
    const chunkIds = await knowledgeBaseService.addChunks(indianFinanceKnowledge);

    logger.info('Knowledge base seeding completed!', {
      total: indianFinanceKnowledge.length,
      successful: chunkIds.length,
      failed: indianFinanceKnowledge.length - chunkIds.length,
    });

    // Get statistics
    const stats = await knowledgeBaseService.getStats();
    logger.info('Knowledge base statistics:', stats);

    process.exit(0);
  } catch (error) {
    logger.error('Knowledge base seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedKnowledgeBase();
}

export default seedKnowledgeBase;


