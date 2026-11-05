import type {
  AdvisorInput,
  AdvisorResponse,
  Evidence,
  FinanceTools,
  Plan,
  ToolName,
} from './types';
import {
  MockAdvisorProvider,
  OpenAIAdvisorProvider,
  forbidden,
  type AdvisorProvider,
} from './provider';
import { validateInput, validatePlan } from './validation';
import { validateOutput } from './outputValidation';
import { buildFindings, evidenceData, health } from './findings';
import { count, timed } from './telemetry';
import { ScopedFinanceTools } from './tools';

const required: Record<Plan['intent'], ToolName[]> = {
  overview: ['get_financial_summary', 'get_budget_status', 'get_goal_progress'],
  spending: ['get_financial_summary', 'get_spending_trends', 'get_category_breakdown'],
  budget: ['get_financial_summary', 'get_budget_status'],
  goal: ['get_financial_summary', 'get_goal_progress'],
  simulation: ['get_financial_summary', 'get_goal_progress'],
  knowledge: ['search_finance_knowledge'],
  unsupported: [],
};
async function deadline<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  ms: number
): Promise<T> {
  parent.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) => {
        const fail = () => reject(new Error('TIMEOUT'));
        controller.signal.addEventListener('abort', fail, { once: true });
        timer = setTimeout(() => controller.abort(), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', abort);
  }
}
export async function advise(
  raw: AdvisorInput,
  tools: FinanceTools,
  provider?: AdvisorProvider
): Promise<AdvisorResponse> {
  const input = validateInput(raw);
  return timed('finance_advisor', async () => {
    count('advisor_requests_total');
    const overall = AbortSignal.timeout(25000);
    const mock = new MockAdvisorProvider();
    let active =
      provider ||
      (process.env.ADVISOR_PROVIDER === 'openai'
        ? new OpenAIAdvisorProvider(usage => {
            count('advisor_tokens', usage.input, { direction: 'input' });
            count('advisor_tokens', usage.output, { direction: 'output' });
            const inputPrice = process.env.ADVISOR_INPUT_USD_PER_MILLION?.trim();
            const outputPrice = process.env.ADVISOR_OUTPUT_USD_PER_MILLION?.trim();
            const inputRate = Number(inputPrice),
              outputRate = Number(outputPrice);
            if (
              inputPrice &&
              outputPrice &&
              Number.isFinite(inputRate) &&
              inputRate >= 0 &&
              Number.isFinite(outputRate) &&
              outputRate >= 0
            )
              count(
                'advisor_estimated_cost',
                (usage.input * inputRate + usage.output * outputRate) / 1e6
              );
          })
        : mock);
    let providerName: AdvisorResponse['provider'] = active.name;
    let plan: Plan;
    if (forbidden(input.question)) plan = { intent: 'unsupported', tools: [] };
    else
      try {
        plan = validatePlan(
          await timed('advisor.plan', () => deadline(s => active.plan(input, s), overall, 6500))
        );
      } catch {
        active = mock;
        providerName = 'mock_fallback';
        plan = await mock.plan(input);
      }
    if (input.simulation && plan.intent !== 'unsupported') plan = await mock.plan(input);
    // Required evidence survives a model selecting the maximum optional tool count.
    const mandatory: ToolName[] = [...required[plan.intent]];
    if (plan.intent === 'simulation')
      mandatory.push(
        plan.simulation?.kind === 'change_deadline'
          ? 'simulate_goal_change'
          : 'simulate_savings_plan'
      );
    plan.tools =
      plan.intent === 'unsupported' ? [] : [...new Set([...mandatory, ...plan.tools])].slice(0, 6);
    const evidence: Evidence[] = [];
    for (const name of plan.tools) {
      if (overall.aborted) break;
      count('advisor_tool_calls', 1, { tool: name });
      const base = {
        id: `e${evidence.length + 1}`,
        tool: name,
        source:
          name === 'search_finance_knowledge'
            ? 'FIN-AI knowledge (untrusted educational text)'
            : 'FIN-AI deterministic application data',
        observedAt: new Date().toISOString(),
      };
      try {
        const data = await timed(`advisor.${name}`, async () => {
          const result = await deadline(
            s => tools.call(name, { query: input.question, simulation: plan.simulation }, s),
            overall,
            3500
          );
          return validateOutput(name, result);
        });
        evidence.push({ ...base, status: 'ok', data } as Evidence);
        if (name.startsWith('simulate_')) count('advisor_simulations');
      } catch (error) {
        count('advisor_tool_failures', 1, { tool: name });
        const code =
          error instanceof Error &&
          ['TIMEOUT', 'INVALID_INPUT', 'NOT_FOUND', 'INSUFFICIENT_DATA'].includes(error.message)
            ? error.message
            : 'UNAVAILABLE';
        evidence.push({ ...base, status: 'error', error: code } as Evidence);
      }
    }
    let status = health(evidence, plan.intent);
    if (evidence.length !== plan.tools.length) status = 'insufficient_evidence';
    let findings = buildFindings(evidence);
    // Put requested simulations/budget problems ahead of generic healthy summaries.
    findings = findings.sort(
      (a, b) =>
        Number(b.id.startsWith('simulation_') || b.id.startsWith('budget_overrun')) -
        Number(a.id.startsWith('simulation_') || a.id.startsWith('budget_overrun'))
    );
    let ids: string[];
    try {
      ids = findings.length
        ? await timed('advisor.select', () =>
            deadline(s => active.select(input.question, findings, s), overall, 6500)
          )
        : [];
    } catch {
      providerName = 'mock_fallback';
      ids = await mock.select(input.question, findings);
    }
    if (
      ids.some(id => !findings.some(f => f.id === id)) ||
      new Set(ids).size !== ids.length ||
      ids.length > 3
    ) {
      providerName = 'mock_fallback';
      ids = await mock.select(input.question, findings);
    }
    const simulations = [
      evidenceData(evidence, 'simulate_savings_plan'),
      evidenceData(evidence, 'simulate_goal_change'),
    ].filter((s): s is NonNullable<typeof s> => !!s);
    const summary = evidenceData(evidence, 'get_financial_summary');
    if (status === 'insufficient_evidence' || status === 'unsupported')
      count('advisor_abstentions', 1, { reason: status });
    if (active.name === 'mock') {
      count('advisor_tokens', 0, { direction: 'input' });
      count('advisor_estimated_cost', 0);
    }
    return {
      summary:
        status === 'unsupported'
          ? 'I can explain recorded finances and simulate plans. I cannot execute transactions, guarantee returns or establish tax/legal certainty. Ask a specific finance question.'
          : status === 'insufficient_evidence'
            ? 'There is not enough reliable recorded data to answer this fully. Available evidence is shown below; no affordability or health assurance is given.'
            : status === 'educational'
              ? 'Educational information retrieved from the FIN-AI knowledge base. It may be dated and does not establish current tax rules or investment suitability.'
              : `Based on recorded activity: income ₹${summary!.totalIncome.toLocaleString('en-IN')}, expenses ₹${summary!.totalExpenses.toLocaleString('en-IN')}, surplus ₹${summary!.netAmount.toLocaleString('en-IN')}. ${status === 'attention' ? 'Review the highlighted commitments.' : 'Recorded cash flow is positive; this is not a complete assessment of your finances.'}`,
      financial_health: status,
      evidence,
      recommendations: ids.map(id => findings.find(f => f.id === id)!),
      tools_used: evidence.map(e => e.tool),
      assumptions: [
        'Only recorded FIN-AI data is authoritative; user-stated salary or balances do not override it.',
        'Cash flow uses UTC calendar windows; budgets use their configured local calendar periods.',
        'Simulations use the last complete month, hold income/expenses constant, assume no returns/inflation/tax, and allocate all remaining surplus to the selected (or earliest active) goal.',
        'Increasing savings assumes an additional source or reduction in spending; it does not create income. An increased SIP reduces liquid goal capacity; holdings and investment suitability are unknown.',
        'Recurring expenses are inferred category repetition, not verified mandates. No money is moved.',
      ],
      confidence:
        status === 'insufficient_evidence' || status === 'unsupported'
          ? 0
          : status === 'educational'
            ? 0.5
            : 0.8,
      simulations,
      provider: providerName,
    };
  });
}
export async function adviseUser(userId: string, input: AdvisorInput): Promise<AdvisorResponse> {
  return advise(input, new ScopedFinanceTools(userId));
}
