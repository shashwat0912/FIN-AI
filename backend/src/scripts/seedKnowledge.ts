import indexRagKnowledge from './indexRagKnowledge';
import logger from '../config/logger';

/**
 * Seed the knowledge base with Indian finance content
 */
async function seedKnowledgeBase() {
  try {
    logger.info('Seeding RAG knowledge base');
    await indexRagKnowledge();
    logger.info('RAG knowledge base seeded successfully');

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

