import { v1FinancialEngine, CashflowResult } from './v1FinancialEngine';

export type V1Context = CashflowResult;

/**
 * Thin wrapper that assembles the data context passed to AI prompts.
 * Uses ONLY v1FinancialEngine — no RAG, no complex pipelines.
 */
export async function buildContext(userId: string): Promise<V1Context> {
  return v1FinancialEngine.getCashflow(userId);
}
