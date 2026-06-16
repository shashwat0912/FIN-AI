import logger from '../config/logger';
import { RAGService } from '../services/ragService';

interface EvalCase {
  query: string;
  expectedCategory: string;
}

const evalCases: EvalCase[] = [
  { query: 'How can I reduce income tax under 80C?', expectedCategory: 'tax_planning' },
  { query: 'Best way to invest monthly for long term growth?', expectedCategory: 'investment' },
  { query: 'How much emergency fund should I keep?', expectedCategory: 'budgeting' },
  { query: 'How to handle high credit card interest?', expectedCategory: 'debt_management' },
  { query: 'I want retirement planning options in India', expectedCategory: 'retirement' },
  { query: 'Should I buy term insurance or ULIP?', expectedCategory: 'insurance' },
];

async function evaluateRag() {
  const ragService = new RAGService();
  let hitsAt3 = 0;
  let hitsAt1 = 0;
  let totalTopScore = 0;

  logger.info('Running RAG evaluation', { totalCases: evalCases.length });

  for (const testCase of evalCases) {
    const retrieved = await ragService.retrieveContext(testCase.query, {
      topK: 3,
      similarityThreshold: 0.1,
      jurisdiction: 'india',
    });

    const top1 = retrieved[0];
    const top3Categories = retrieved.map((item) => item.category);
    const hit3 = top3Categories.includes(testCase.expectedCategory);
    const hit1 = top1?.category === testCase.expectedCategory;

    if (hit3) hitsAt3 += 1;
    if (hit1) hitsAt1 += 1;
    totalTopScore += top1?.similarity || 0;

    logger.info('Eval case', {
      query: testCase.query,
      expectedCategory: testCase.expectedCategory,
      top1Category: top1?.category || 'none',
      top1Score: top1?.similarity || 0,
      hitAt1: hit1,
      hitAt3: hit3,
    });
  }

  const result = {
    totalCases: evalCases.length,
    hitAt1: Number((hitsAt1 / evalCases.length).toFixed(4)),
    hitAt3: Number((hitsAt3 / evalCases.length).toFixed(4)),
    averageTop1Similarity: Number((totalTopScore / evalCases.length).toFixed(4)),
  };

  logger.info('RAG evaluation complete', result);
}

if (require.main === module) {
  evaluateRag()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('RAG evaluation failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      process.exit(1);
    });
}

export default evaluateRag;

