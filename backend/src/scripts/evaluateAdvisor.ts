import { randomBytes } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.ADVISOR_PROVIDER = 'mock';
process.env.ADVISOR_TELEMETRY = 'none';
process.env.LOG_LEVEL = 'error';
process.env.EMBEDDING_PROVIDER = 'local';
process.env.DATABASE_URL ||= 'postgresql://financeai_test@localhost:5433/finance_ai_test';
process.env.JWT_SECRET ||= randomBytes(64).toString('hex');
process.env.JWT_REFRESH_SECRET ||= randomBytes(64).toString('hex');
void import('../advisor/evals')
  .then(async ({ evaluateAdvisor }) => {
    const result = await evaluateAdvisor();
    console.log(JSON.stringify(result, null, 2));
    if (
      result.correctOutcomes !== result.scenarios ||
      result.hallucinations ||
      result.unsafeFinancialActions ||
      result.correctToolSelection !== result.scenarios ||
      result.recommendationRelevance !== result.scenarios ||
      result.simulationCorrectness !== result.simulationScenarios
    )
      process.exitCode = 1;
  })
  .catch(() => {
    console.error('Advisor evaluation failed');
    process.exitCode = 1;
  });
