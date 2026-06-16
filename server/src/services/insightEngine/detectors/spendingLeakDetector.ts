import { InsightCandidate, InsightDetector } from '../types';
import { getRollingDayWindow } from '../utils/dateUtils';
import { aggregateByCategory, getAllCategories, roundCurrency } from '../utils/aggregationUtils';

const WEEK_TO_MONTH_MULTIPLIER = 4;

class SpendingLeakDetector implements InsightDetector {
  detect(context: Parameters<InsightDetector['detect']>[0]): InsightCandidate[] {
    const currentWindow = getRollingDayWindow(context.generatedAt, 7, 0, 'last_7_days');
    const previousWindow = getRollingDayWindow(context.generatedAt, 7, 7, 'previous_7_days');

    const currentTotals = aggregateByCategory(context.transactions, currentWindow);
    const previousTotals = aggregateByCategory(context.transactions, previousWindow);
    const categories = getAllCategories([currentTotals, previousTotals]);

    return categories.flatMap((category) => {
      const currentSpend = currentTotals[category] || 0;
      const previousSpend = previousTotals[category] || 0;

      if (previousSpend <= 0 || currentSpend <= previousSpend * 1.3) {
        return [];
      }

      const weeklyLeak = roundCurrency(currentSpend - previousSpend);
      const monthlyImpact = roundCurrency(weeklyLeak * WEEK_TO_MONTH_MULTIPLIER);
      const yearlyImpact = roundCurrency(monthlyImpact * 12);

      return [
        {
          type: 'SPENDING_LEAK',
          category,
          title: `${category} spending leak detected`,
          description: `You spent ₹${weeklyLeak.toLocaleString('en-IN')} more on ${category} in the last 7 days compared to the previous 7 days.`,
          impact: {
            monthly: monthlyImpact,
            yearly: yearlyImpact,
          },
          suggestedAction: {
            type: 'review_category',
            payload: {
              category,
              currentSpend,
              previousSpend,
            },
          },
          confidenceSignals: {
            sampleSize: 2,
            ratio: currentSpend / previousSpend,
            volatility: 0,
          },
        },
      ];
    });
  }
}

export const spendingLeakDetector = new SpendingLeakDetector();
