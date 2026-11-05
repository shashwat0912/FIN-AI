import type { AdvisorResponse, Evidence, Finding, ToolData, ToolName } from './types';
export function evidenceData<K extends ToolName>(
  evidence: Evidence[],
  name: K
): ToolData[K] | undefined {
  const e = evidence.find(e => e.tool === name && e.status === 'ok');
  return e?.status === 'ok' ? (e.data as ToolData[K]) : undefined;
}
const rupees = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function buildFindings(evidence: Evidence[]): Finding[] {
  const findings: Finding[] = [];
  const add = (id: string, text: string, tools: ToolName[]) =>
    findings.push({
      id,
      text,
      evidenceIds: evidence.filter(e => e.status === 'ok' && tools.includes(e.tool)).map(e => e.id),
    });
  const summary = evidenceData(evidence, 'get_financial_summary');
  if (summary && summary.transactionCount >= 3 && summary.totalIncome > 0) {
    if (summary.savingsRate < 0.2)
      add(
        'low_savings',
        `Recorded monthly savings are ${rupees(summary.netAmount)}. Review discretionary expenses before increasing commitments.`,
        ['get_financial_summary']
      );
    else
      add(
        'maintain_buffer',
        `Recorded monthly surplus is ${rupees(summary.netAmount)}. Reserve a cash buffer before committing it to goals or investments.`,
        ['get_financial_summary']
      );
  }
  const budgets = evidenceData(evidence, 'get_budget_status');
  if (budgets?.length === 0)
    add(
      'missing_budget',
      'Create a category budget to compare actual spending with your own limits.',
      ['get_budget_status']
    );
  budgets
    ?.filter(b => b.status === 'UNMAPPED')
    .slice(0, 1)
    .forEach(() =>
      add(
        'unmapped_budget',
        'Assign a supported category to unmapped budgets before relying on their spending totals.',
        ['get_budget_status']
      )
    );
  budgets
    ?.filter(b => b.remaining < 0)
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 3)
    .forEach((b, i) =>
      add(
        `budget_overrun_${i}`,
        `${b.category}: spending is ${rupees(b.spent)} against ${rupees(b.amount)}. Reduce discretionary purchases in this category first.`,
        ['get_budget_status']
      )
    );
  const trends = evidenceData(evidence, 'get_spending_trends');
  if (trends?.comparable && trends.expenseChange > 0)
    add(
      'spending_increase',
      `Recorded expenses increased by ${rupees(trends.expenseChange)} versus the matched prior-month window. Review the category breakdown; this does not establish the cause of the increase.`,
      ['get_spending_trends', 'get_category_breakdown']
    );
  const categories = evidenceData(evidence, 'get_category_breakdown');
  if (categories?.length)
    add(
      'largest_category',
      `${categories[0].category} is the largest recorded category at ${rupees(categories[0].amount)}. Check whether any purchases can be deferred.`,
      ['get_category_breakdown']
    );
  const recurring = evidenceData(evidence, 'get_recurring_expenses');
  if (recurring?.total)
    add(
      'recurring_review',
      `Review ${rupees(recurring.total)} of inferred recurring categories from the last complete month. Repetition is not proof of an active subscription.`,
      ['get_recurring_expenses']
    );
  const goals = evidenceData(evidence, 'get_goal_progress');
  if (goals?.length === 0)
    add(
      'missing_goal',
      'Add a goal with a target and deadline to calculate a personal savings schedule.',
      ['get_goal_progress']
    );
  goals
    ?.filter(g => g.status === 'behind' || g.status === 'ahead')
    .slice(0, 2)
    .forEach((g, i) =>
      add(
        `goal_${g.status}_${i}`,
        g.monthlyRequired === null
          ? 'A goal deadline is before the next monthly contribution or has passed. Review the remaining balance and deadline.'
          : `A goal needs ${rupees(g.monthlyRequired)} per month. It is ${g.status} of the last complete month’s surplus pace, assuming the entire surplus goes to this goal.`,
        ['get_goal_progress']
      )
    );
  const simulation =
    evidenceData(evidence, 'simulate_savings_plan') ||
    evidenceData(evidence, 'simulate_goal_change');
  if (simulation) {
    add(
      'simulation_impact',
      `Scenario savings capacity: ${rupees(simulation.scenarioMonthlySavings)} per month. ${simulation.scenarioMonths === null ? 'The goal has no finite completion estimate at this savings pace.' : `Goal completion takes ${simulation.scenarioMonths} months under these assumptions.`} ${simulation.affordable ? 'A non-negative surplus alone does not establish investment suitability or affordability.' : 'This scenario exceeds the recorded monthly surplus.'}`,
      [simulation.kind === 'change_deadline' ? 'simulate_goal_change' : 'simulate_savings_plan']
    );
  }
  const knowledge = evidenceData(evidence, 'search_finance_knowledge');
  knowledge?.forEach((k, i) =>
    add(
      `knowledge_${i}`,
      `Educational excerpt (may be dated; not a current regulatory statement): ${k.excerpt}`,
      ['search_finance_knowledge']
    )
  );
  return findings;
}
export function health(evidence: Evidence[], intent: string): AdvisorResponse['financial_health'] {
  if (intent === 'unsupported') return 'unsupported';
  if (evidence.some(e => e.status === 'error')) return 'insufficient_evidence';
  if (intent === 'knowledge')
    return evidenceData(evidence, 'search_finance_knowledge')?.length
      ? 'educational'
      : 'insufficient_evidence';
  const summary = evidenceData(evidence, 'get_financial_summary');
  if (!summary || summary.transactionCount < 3 || !summary.totalIncome)
    return 'insufficient_evidence';
  if (intent === 'goal' && !evidenceData(evidence, 'get_goal_progress')?.length)
    return 'insufficient_evidence';
  if (intent === 'budget' && !evidenceData(evidence, 'get_budget_status')?.length)
    return 'insufficient_evidence';
  if (intent === 'spending' && !evidenceData(evidence, 'get_spending_trends')?.comparable)
    return 'insufficient_evidence';
  return summary.savingsRate < 0.2 ||
    evidenceData(evidence, 'get_budget_status')?.some(b => b.remaining < 0) ||
    evidenceData(evidence, 'get_goal_progress')?.some(g => g.status === 'behind')
    ? 'attention'
    : 'stable';
}
