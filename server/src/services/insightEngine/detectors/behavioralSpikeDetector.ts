import { InsightCandidate, InsightDetector } from '../types';
import { getCurrentWeekToDateWindow, getPreviousWeekWindows, projectToFullWeek } from '../utils/dateUtils';
import {
  aggregateByCategory,
  average,
  buildCategorySeries,
  roundCurrency,
  standardDeviation,
} from '../utils/aggregationUtils';

const WEEK_TO_MONTH_MULTIPLIER = 4;
const BASELINE_WEEKS = 4;
const MIN_HISTORY_POINTS = 3;

class BehavioralSpikeDetector implements InsightDetector {
  detect(context: Parameters<InsightDetector['detect']>[0]): InsightCandidate[] {
    const currentWeekWindow = getCurrentWeekToDateWindow(context.generatedAt);
    const historicalWindows = getPreviousWeekWindows(context.generatedAt, BASELINE_WEEKS);
    const currentTotals = aggregateByCategory(context.transactions, currentWeekWindow);
    const historicalSeries = buildCategorySeries(context.transactions, historicalWindows);

    return Object.entries(historicalSeries).flatMap(([category, weeklyValues]) => {
      const nonZeroHistory = weeklyValues.filter((value) => value > 0);
      const currentWeekSpend = currentTotals[category] || 0;

      if (nonZeroHistory.length < MIN_HISTORY_POINTS || currentWeekSpend <= 0) {
        return [];
      }

      const baseline = average(nonZeroHistory);
      const deviation = standardDeviation(nonZeroHistory);
      const projectedWeekSpend = roundCurrency(projectToFullWeek(currentWeekSpend, context.generatedAt));
      const spikeThreshold = baseline + 2 * deviation;

      if (baseline <= 0 || projectedWeekSpend <= spikeThreshold) {
        return [];
      }

      const weeklySpike = roundCurrency(projectedWeekSpend - baseline);
      const monthlyImpact = roundCurrency(weeklySpike * WEEK_TO_MONTH_MULTIPLIER);
      const yearlyImpact = roundCurrency(monthlyImpact * 12);
      const normalizedVolatility = baseline > 0 ? deviation / baseline : 0;

      return [
        {
          type: 'SPENDING_SPIKE',
          category,
          title: `${category} spending spike detected`,
          description: `Your projected ${category} spend for this week is ₹${projectedWeekSpend.toLocaleString('en-IN')}, versus a usual weekly average of ₹${roundCurrency(baseline).toLocaleString('en-IN')}. That is an unusual spike of ₹${weeklySpike.toLocaleString('en-IN')}.`,
          impact: {
            monthly: monthlyImpact,
            yearly: yearlyImpact,
          },
          suggestedAction: {
            type: 'reduce_spending',
            payload: {
              category,
              projectedWeekSpend,
              baselineWeeklySpend: roundCurrency(baseline),
            },
          },
          confidenceSignals: {
            sampleSize: nonZeroHistory.length,
            ratio: projectedWeekSpend / baseline,
            volatility: normalizedVolatility,
          },
        },
      ];
    });
  }
}

export const behavioralSpikeDetector = new BehavioralSpikeDetector();
