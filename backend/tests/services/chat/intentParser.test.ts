import { describe, it, expect } from 'vitest';
import { IntentParser } from '../../../src/services/chat/intentParser';
import { RegexFallbackParser } from '../../../src/services/chat/regexFallbackParser';
import { ChatIntentType } from '../../../src/types';

describe('IntentParser deterministic parsing', () => {
  const parser = new IntentParser();

  it('parses "Check budget" as QUERY_BUDGET', async () => {
    const result = await parser.parse('Check budget', []);
    expect(result.intent).toBe(ChatIntentType.QUERY_BUDGET);
  });

  it('parses monthly spend question as QUERY_SPENDING with this_month', async () => {
    const result = await parser.parse('How much did I spend this month?', []);
    expect(result.intent).toBe(ChatIntentType.QUERY_SPENDING);
    expect(result.entities).toMatchObject({
      timeRange: 'this_month',
      type: 'expense',
    });
  });

  it('parses "Monthly summary" as QUERY_SPENDING with this_month', async () => {
    const result = await parser.parse('Monthly summary', []);
    expect(result.intent).toBe(ChatIntentType.QUERY_SPENDING);
    expect(result.entities).toMatchObject({
      timeRange: 'this_month',
      type: 'expense',
    });
  });

  it('parses "Set food budget to 5000 this month" as SET_BUDGET', async () => {
    const result = await parser.parse('Set food budget to 5000 this month', []);
    expect(result.intent).toBe(ChatIntentType.SET_BUDGET);
    expect(result.entities).toMatchObject({
      category: 'Food',
      amount: 5000,
      period: 'monthly',
    });
  });

  it('parses "How much did I spend on food this week?" with category and range', async () => {
    const result = await parser.parse('How much did I spend on food this week?', []);
    expect(result.intent).toBe(ChatIntentType.QUERY_SPENDING);
    expect(result.entities).toMatchObject({
      category: 'Food',
      timeRange: 'this_week',
      type: 'expense',
    });
  });
});

describe('RegexFallbackParser income parsing', () => {
  const parser = new RegexFallbackParser();

  it('parses "60000 salay" as income and normalizes description', () => {
    const result = parser.parse('60000 salay');
    expect(result?.intent).toBe(ChatIntentType.LOG_INCOME);
    expect(result?.entities).toMatchObject({
      amount: 60000,
      type: 'income',
      description: 'salary',
    });
  });

  it('parses monthly summary query in fallback parser', () => {
    const result = parser.parse('How much did I spend this month?');
    expect(result?.intent).toBe(ChatIntentType.QUERY_SPENDING);
    expect(result?.entities).toMatchObject({
      timeRange: 'this_month',
      type: 'expense',
    });
  });

  it('parses budget check in fallback parser', () => {
    const result = parser.parse('Check budget');
    expect(result?.intent).toBe(ChatIntentType.QUERY_BUDGET);
  });
});
