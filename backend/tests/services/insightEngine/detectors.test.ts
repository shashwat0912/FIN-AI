import { describe, expect, it } from 'vitest';
import { spendingLeakDetector } from '../../../src/services/insightEngine/detectors/spendingLeakDetector';
import { budgetBreachDetector } from '../../../src/services/insightEngine/detectors/budgetBreachDetector';
import { behavioralSpikeDetector } from '../../../src/services/insightEngine/detectors/behavioralSpikeDetector';
import { DetectorContext, InsightTransaction } from '../../../src/services/insightEngine/types';

function makeTransaction(id: string, category: string, amount: number, date: string): InsightTransaction {
  return {
    id,
    category,
    amount,
    date: new Date(date),
  };
}

function makeContext(transactions: InsightTransaction[]): DetectorContext {
  return {
    userId: 'user-1',
    generatedAt: new Date('2026-03-18T10:00:00.000Z'),
    transactions,
  };
}

describe('insight engine detectors', () => {
  it('detects a spending leak from last 7 days versus the previous 7 days', () => {
    const context = makeContext([
      makeTransaction('t1', 'Food', 600, '2026-03-06T10:00:00.000Z'),
      makeTransaction('t2', 'Food', 400, '2026-03-10T10:00:00.000Z'),
      makeTransaction('t3', 'Food', 1000, '2026-03-13T10:00:00.000Z'),
      makeTransaction('t4', 'Food', 800, '2026-03-17T10:00:00.000Z'),
    ]);

    const insights = spendingLeakDetector.detect(context);

    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('SPENDING_LEAK');
    expect(insights[0].category).toBe('Food');
    expect(insights[0].impact.monthly).toBe(3200);
    expect(insights[0].description).toContain('₹800');
  });

  it('detects a budget warning when current week pace points to overspending', () => {
    const context = makeContext([
      makeTransaction('t1', 'Transport', 1000, '2026-03-11T10:00:00.000Z'),
      makeTransaction('t2', 'Transport', 500, '2026-03-16T10:00:00.000Z'),
      makeTransaction('t3', 'Transport', 400, '2026-03-18T10:00:00.000Z'),
    ]);

    const insights = budgetBreachDetector.detect(context);

    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('BUDGET_WARNING');
    expect(insights[0].category).toBe('Transport');
    expect(insights[0].description).toContain('overspend');
    expect(insights[0].impact.monthly).toBe(4400);
  });

  it('detects a behavioral spike using historical weekly baseline and deviation', () => {
    const context = makeContext([
      makeTransaction('t1', 'Entertainment', 90, '2026-02-17T10:00:00.000Z'),
      makeTransaction('t2', 'Entertainment', 110, '2026-02-25T10:00:00.000Z'),
      makeTransaction('t3', 'Entertainment', 120, '2026-03-03T10:00:00.000Z'),
      makeTransaction('t4', 'Entertainment', 100, '2026-03-12T10:00:00.000Z'),
      makeTransaction('t5', 'Entertainment', 300, '2026-03-17T10:00:00.000Z'),
    ]);

    const insights = behavioralSpikeDetector.detect(context);

    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('SPENDING_SPIKE');
    expect(insights[0].category).toBe('Entertainment');
    expect(insights[0].description).toContain('unusual spike');
    expect(insights[0].impact.monthly).toBe(2380);
  });
});
