import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('../../../src/config/database', () => ({
  default: {
    transaction: {
      findMany: mockFindMany,
    },
  },
}));

import { generateInsights } from '../../../src/services/insightEngine';

describe('generateInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sorted deterministic insights from the last 30 days of expense data', async () => {
    mockFindMany.mockResolvedValue([
      { id: 't1', category: 'Food', amount: 600, date: new Date('2026-03-06T10:00:00.000Z') },
      { id: 't2', category: 'Food', amount: 400, date: new Date('2026-03-10T10:00:00.000Z') },
      { id: 't3', category: 'Food', amount: 1000, date: new Date('2026-03-13T10:00:00.000Z') },
      { id: 't4', category: 'Food', amount: 800, date: new Date('2026-03-17T10:00:00.000Z') },
      { id: 't5', category: 'Transport', amount: 1000, date: new Date('2026-03-11T10:00:00.000Z') },
      { id: 't6', category: 'Transport', amount: 500, date: new Date('2026-03-16T10:00:00.000Z') },
      { id: 't7', category: 'Transport', amount: 400, date: new Date('2026-03-18T10:00:00.000Z') },
      { id: 't8', category: 'Entertainment', amount: 90, date: new Date('2026-02-17T10:00:00.000Z') },
      { id: 't9', category: 'Entertainment', amount: 110, date: new Date('2026-02-25T10:00:00.000Z') },
      { id: 't10', category: 'Entertainment', amount: 120, date: new Date('2026-03-03T10:00:00.000Z') },
      { id: 't11', category: 'Entertainment', amount: 100, date: new Date('2026-03-12T10:00:00.000Z') },
      { id: 't12', category: 'Entertainment', amount: 300, date: new Date('2026-03-17T10:00:00.000Z') },
    ]);

    const insights = await generateInsights('user-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          type: 'EXPENSE',
        }),
      })
    );
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.length).toBeLessThanOrEqual(5);
    expect(insights.map((insight) => insight.type)).toEqual(
      expect.arrayContaining(['SPENDING_LEAK', 'BUDGET_WARNING', 'SPENDING_SPIKE'])
    );
    expect(insights[0].priorityScore).toBeGreaterThanOrEqual(insights[1].priorityScore);
    expect(insights[1].priorityScore).toBeGreaterThanOrEqual(insights[2].priorityScore);
    expect(insights[0].createdAt.toISOString()).toBe('2026-03-18T10:00:00.000Z');
    expect(insights.every((insight) => insight.confidence >= 0.5 && insight.confidence <= 1)).toBe(true);
    expect(insights.every((insight) => insight.priorityScore === Number((insight.impact.monthly * insight.confidence).toFixed(2)))).toBe(true);
  });

  it('returns an empty array when there are no recent expense transactions', async () => {
    mockFindMany.mockResolvedValue([]);

    const insights = await generateInsights('user-1');

    expect(insights).toEqual([]);
  });
});
