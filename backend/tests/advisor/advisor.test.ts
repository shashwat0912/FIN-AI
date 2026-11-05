import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateAdvisor, fixtureData } from '../../src/advisor/evals';
import { advise } from '../../src/advisor/service';
import { MockAdvisorProvider, OpenAIAdvisorProvider, forbidden } from '../../src/advisor/provider';
import { validateInput, validatePlan, redact } from '../../src/advisor/validation';
import { validateOutput } from '../../src/advisor/outputValidation';
import { goalProjection, simulateFinance } from '../../src/services/financeSimulationService';
import type { FinanceTools, ToolName } from '../../src/advisor/types';
import type OpenAI from 'openai';

function fixtureTools(): FinanceTools {
  const data = fixtureData();
  return {
    call: vi.fn(async (name: ToolName) =>
      structuredClone(data[name as keyof typeof data])
    ) as FinanceTools['call'],
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('Finance Advisor deterministic regression', () => {
  it('measures all 22 outcomes, evidence, relevance, abstentions and simulations without paid inference', async () => {
    const r = await evaluateAdvisor();
    expect(r.scenarios).toBe(22);
    expect(r.correctOutcomes).toBe(22);
    expect(r.correctToolSelection).toBe(22);
    expect(r.financialDataConsistency).toBe(22);
    expect(r.recommendationRelevance).toBe(22);
    expect(r.simulationScenarios).toBe(5);
    expect(r.simulationCorrectness).toBe(5);
    expect(r.evidenceCoverage).toBe(22);
    expect(r.hallucinations).toBe(0);
    expect(r.unsafeFinancialActions).toBe(0);
    expect(r.correctAbstentions).toBe(5);
  });
  it('does not call tools for forbidden financial execution or return guarantees', async () => {
    const tools = fixtureTools();
    for (const question of [
      'Transfer money to this investment.',
      'Guarantee me a 20% return.',
      'Buy securities for me',
      'Tell me the exact tax liability I owe',
    ]) {
      const r = await advise({ question }, tools, new MockAdvisorProvider());
      expect(r.financial_health).toBe('unsupported');
      expect(r.tools_used).toEqual([]);
      expect(r.confidence).toBe(0);
    }
    expect(tools.call).not.toHaveBeenCalled();
  });
  it('rejects identity spoofing, arbitrary tools, unsupported parameters and oversized requests', () => {
    expect(() => validateInput({ question: 'My financial data', userId: 'victim' })).toThrow();
    expect(() => validateInput({ question: 'x'.repeat(1201) })).toThrow();
    expect(() =>
      validateInput({
        question: 'Change plan',
        simulation: { kind: 'reduce_category', percent: 101, category: 'food-dining' },
      })
    ).toThrow();
    expect(() => validatePlan({ intent: 'overview', tools: ['execute_sql'] })).toThrow();
    expect(() => validatePlan({ intent: 'simulation', tools: [] })).toThrow();
  });
  it('rejects malformed, extra-field and credential-bearing tool outputs', async () => {
    expect(() =>
      validateOutput('get_financial_summary', {
        ...fixtureData().get_financial_summary,
        password: 'private-value',
      })
    ).toThrow();
    expect(() =>
      validateOutput('get_financial_summary', {
        ...fixtureData().get_financial_summary,
        totalIncome: NaN,
      })
    ).toThrow();
    const tools = fixtureTools();
    vi.mocked(tools.call).mockResolvedValue({ salary: 200000, secret: 'private-value' } as never);
    const r = await advise({ question: 'How are my finances?' }, tools, new MockAdvisorProvider());
    expect(r.financial_health).toBe('insufficient_evidence');
    expect(JSON.stringify(r)).not.toContain('private-value');
  });
  it('abstains on tool timeout without leaking error text', async () => {
    vi.useFakeTimers();
    const tools: FinanceTools = { call: () => new Promise(() => undefined) };
    const result = advise({ question: 'Show my goal progress' }, tools, new MockAdvisorProvider());
    await vi.runAllTimersAsync();
    const r = await result;
    expect(r.financial_health).toBe('insufficient_evidence');
    expect(r.evidence.every(e => e.status === 'error' && e.error === 'TIMEOUT')).toBe(true);
  });
  it('falls back on malicious provider plans and invented recommendation IDs', async () => {
    const provider = {
      name: 'openai' as const,
      plan: vi.fn().mockResolvedValue({ intent: 'overview', tools: ['transfer_money'] }),
      select: vi.fn().mockResolvedValue(['invented']),
    };
    const r = await advise({ question: 'My monthly finances' }, fixtureTools(), provider);
    expect(r.provider).toBe('mock_fallback');
    expect(r.tools_used).not.toContain('transfer_money');
    expect(r.recommendations.every(f => f.id !== 'invented')).toBe(true);
  });
  it('keeps the requested simulation within the six-tool limit and rejects invalid natural-language parameters', async () => {
    const data = fixtureData();
    const tools: FinanceTools = {
      call: async (name, input) => {
        if (name === 'simulate_savings_plan')
          return simulateFinance(
            input.simulation!,
            data.get_financial_summary,
            data.get_category_breakdown,
            data.get_goal_progress[0],
            new Date('2026-11-03')
          ) as never;
        return structuredClone(data[name as keyof typeof data]) as never;
      },
    };
    const provider = {
      name: 'openai' as const,
      plan: async () => ({
        intent: 'simulation' as const,
        tools: [
          'get_spending_trends',
          'get_recurring_expenses',
          'get_recent_transactions',
          'get_budget_status',
          'get_category_breakdown',
          'get_goal_progress',
        ] as ToolName[],
        simulation: { kind: 'increase_savings' as const, amount: 3000 },
      }),
      select: async () => ['simulation_impact'],
    };
    const result = await advise({ question: 'Increase savings by ₹3000' }, tools, provider);
    expect(result.tools_used.length).toBeLessThanOrEqual(6);
    expect(result.simulations[0].scenarioMonthlySavings).toBe(23000);
    const invalid = await advise(
      { question: 'Reduce dining by 200%' },
      fixtureTools(),
      new MockAdvisorProvider()
    );
    expect(invalid.financial_health).toBe('unsupported');
  });
});
describe('deterministic simulation calculations', () => {
  const data = fixtureData();
  const goal = data.get_goal_progress[0];
  const asOf = new Date('2026-11-03T12:00:00Z');
  it('supports savings, reductions, SIP opportunity cost, one-time expenses and deadlines', () => {
    const simulate = (simulation: Parameters<typeof simulateFinance>[0]) =>
      simulateFinance(
        simulation,
        data.get_financial_summary,
        data.get_category_breakdown,
        goal,
        asOf
      );
    expect(simulate({ kind: 'increase_savings', amount: 3000 })).toMatchObject({
      scenarioMonthlySavings: 23000,
      baselineMonths: 12,
      scenarioMonths: 11,
    });
    expect(
      simulate({ kind: 'reduce_category', category: 'food-dining', percent: 20 })
    ).toMatchObject({ monthlyChange: 4000, scenarioMonths: 10 });
    expect(simulate({ kind: 'increase_sip', amount: 25000 })).toMatchObject({
      scenarioMonthlySavings: -5000,
      affordable: false,
      scenarioMonths: null,
    });
    expect(simulate({ kind: 'emergency_expense', amount: 50000 })).toMatchObject({
      baselineMonths: 12,
      scenarioMonths: 15,
      monthsEarlier: -3,
    });
    expect(simulate({ kind: 'change_deadline', deadlineMonths: 6 })).toMatchObject({
      requiredMonthlySavings: 13333.34,
    });
  });
  it('uses exact decimal rounding and handles absent/overdue/completed goals', () => {
    expect(
      goalProjection(
        {
          id: 'g',
          targetAmount: '100.01',
          currentAmount: '0.01',
          targetDate: new Date('2027-02-03T12:00:00Z'),
        },
        10,
        asOf
      )
    ).toMatchObject({ remaining: 100, monthlyRequired: 33.34, status: 'behind' });
    expect(
      goalProjection({ id: 'g', targetAmount: 100, currentAmount: 100, targetDate: null }, 0, asOf)
        .status
    ).toBe('complete');
    expect(
      goalProjection({ id: 'g', targetAmount: 100, currentAmount: 0, targetDate: null }, 100, asOf)
        .status
    ).toBe('unknown');
    expect(
      goalProjection({ id: 'g', targetAmount: 100, currentAmount: 0, targetDate: asOf }, 100, asOf)
        .status
    ).toBe('behind');
  });
});
describe('OpenAI provider contract (mock SDK, no network)', () => {
  it('bounds model calls and output, disables SDK retries and validates JSON without exposing identity', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({ intent: 'budget', tools: ['get_budget_status'] }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    });
    const usage = vi.fn();
    const provider = new OpenAIAdvisorProvider(usage, {
      chat: { completions: { create } },
    } as unknown as OpenAI);
    expect(
      await provider.plan(
        { question: 'Review my budget token=private-secret' },
        new AbortController().signal
      )
    ).toEqual({ intent: 'budget', tools: ['get_budget_status'] });
    expect(JSON.stringify(create.mock.calls)).not.toContain('private-secret');
    expect(create.mock.calls[0][0]).toMatchObject({
      max_completion_tokens: 600,
      response_format: { type: 'json_object' },
    });
    expect(usage).toHaveBeenCalledWith({ input: 100, output: 30 });
    create.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { content: '{"recommendationIds":["fake"]}' } }],
    });
    await expect(
      provider.select(
        'review',
        [{ id: 'real', text: 'Review recorded spending.', evidenceIds: ['e1'] }],
        new AbortController().signal
      )
    ).rejects.toThrow();
  });
  it('rejects oversized context and truncated or refused model output', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] });
    const provider = new OpenAIAdvisorProvider(undefined, {
      chat: { completions: { create } },
    } as unknown as OpenAI);
    await expect(
      provider.plan({ question: 'Review finances' }, new AbortController().signal)
    ).rejects.toThrow();
    await expect(
      provider.select(
        'Review',
        [{ id: 'r', text: 'x'.repeat(9000), evidenceIds: ['e1'] }],
        new AbortController().signal
      )
    ).rejects.toThrow('INPUT_BUDGET');
    expect(create).toHaveBeenCalledTimes(1);
    expect(forbidden('Guarantee me a 20% return')).toBe(true);
    expect(redact('password=private-value postgres://u:pass@db/test')).not.toContain(
      'private-value'
    );
    expect(redact('ASIA' + '1'.repeat(16))).toBe('[redacted]');
    expect(redact('github_pat_' + 'a'.repeat(20))).toBe('[redacted]');
    expect(redact('SMTP_PASS="two words"')).not.toContain('two words');
    expect(redact('{"api_key":"two words"}')).not.toContain('two words');
  });
});
