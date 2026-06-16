import { InsightCandidate, InsightDetector } from '../types';
import { getCurrentWeekToDateWindow, getPreviousWeekWindow, projectToFullWeek } from '../utils/dateUtils';
import { aggregateByCategory, getAllCategories, roundCurrency } from '../utils/aggregationUtils';

const WEEK_TO_MONTH_MULTIPLIER = 4;

class BudgetBreachDetector implements InsightDetector {
  detect(context: Parameters<InsightDetector['detect']>[0]): InsightCandidate[] {
    const currentWeekWindow = getCurrentWeekToDateWindow(context.generatedAt);
    const previousWeekWindow = getPreviousWeekWindow(context.generatedAt);

    const currentTotals = aggregateByCategory(context.transactions, currentWeekWindow);
    const previousTotals = aggregateByCategory(context.transactions, previousWeekWindow);
    const categories = getAllCategories([currentTotals, previousTotals]);

    return categories.flatMap((category) => {
      const currentWeekSpend = currentTotals[category] || 0;
      const previousWeekSpend = previousTotals[category] || 0;

      if (previousWeekSpend <= 0 || currentWeekSpend <= previousWeekSpend * 0.8) {
        return [];
      }

      const projectedWeekSpend = roundCurrency(projectToFullWeek(currentWeekSpend, context.generatedAt));
      const projectedOverspend = roundCurrency(Math.max(0, projectedWeekSpend - previousWeekSpend));

      if (projectedOverspend <= 0) {
        return [];
      }

      const monthlyImpact = roundCurrency(projectedOverspend * WEEK_TO_MONTH_MULTIPLIER);
      const yearlyImpact = roundCurrency(monthlyImpact * 12);
      const utilization = roundCurrency((currentWeekSpend / previousWeekSpend) * 100);

      return [
        {
          type: 'BUDGET_WARNING',
          category,
          title: `${category} budget pressure building`,
          description: `You have already spent ₹${roundCurrency(currentWeekSpend).toLocaleString('en-IN')} on ${category} this week, which is ${utilization}% of last week's ₹${roundCurrency(previousWeekSpend).toLocaleString('en-IN')}. At this pace you may overspend by ₹${projectedOverspend.toLocaleString('en-IN')}.`,
          impact: {
            monthly: monthlyImpact,
            yearly: yearlyImpact,
          },
          suggestedAction: {
            type: 'set_budget',
            payload: {
              category,
              baselineWeeklySpend: previousWeekSpend,
              projectedWeekSpend,
            },
          },
          confidenceSignals: {
            sampleSize: 2,
            ratio: projectedWeekSpend / previousWeekSpend,
            volatility: 0,
          },
        },
      ];
    });
  }
}

export const budgetBreachDetector = new BudgetBreachDetector();
