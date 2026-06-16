import { Insight } from '../types';

export function scoreInsight(impactMonthly: number, confidence: number): number {
  return Number((impactMonthly * confidence).toFixed(2));
}

export function sortInsightsByPriority(insights: Insight[]): Insight[] {
  return [...insights].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    return right.impact.monthly - left.impact.monthly;
  });
}
