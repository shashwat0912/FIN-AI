export const TOOL_NAMES = [
  'get_financial_summary',
  'get_budget_status',
  'get_goal_progress',
  'get_spending_trends',
  'get_category_breakdown',
  'get_recurring_expenses',
  'get_recent_transactions',
  'simulate_savings_plan',
  'simulate_goal_change',
  'search_finance_knowledge',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type Intent =
  | 'overview'
  | 'spending'
  | 'budget'
  | 'goal'
  | 'simulation'
  | 'knowledge'
  | 'unsupported';
export interface SimulationInput {
  kind:
    | 'increase_savings'
    | 'reduce_category'
    | 'increase_sip'
    | 'emergency_expense'
    | 'change_deadline';
  amount?: number;
  percent?: number;
  category?: string;
  goalId?: string;
  deadlineMonths?: number;
}
export interface AdvisorInput {
  question: string;
  simulation?: SimulationInput;
}
export interface Plan {
  intent: Intent;
  tools: ToolName[];
  simulation?: SimulationInput;
}
export interface Summary {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  topCategories: { category: string; amount: number }[];
  netAmount: number;
  transactionCount: number;
  start: string;
  end: string;
}
export interface BudgetRow {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  status: string;
  periodStart: string;
  periodEnd: string;
}
export interface GoalRow {
  id: string;
  name: string;
  target: number;
  current: number;
  remaining: number;
  targetDate: string | null;
  monthlyRequired: number | null;
  monthsRemaining: number | null;
  status: 'ahead' | 'behind' | 'unknown' | 'complete';
}
export interface CategoryRow {
  category: string;
  amount: number;
}
export interface Simulation {
  kind: SimulationInput['kind'];
  goalId: string;
  baselineMonthlySavings: number;
  monthlyChange: number;
  scenarioMonthlySavings: number;
  remaining: number;
  baselineMonths: number | null;
  scenarioMonths: number | null;
  monthsEarlier: number | null;
  baselineCompletion: string | null;
  scenarioCompletion: string | null;
  requiredMonthlySavings: number | null;
  affordable: boolean;
  basis: string;
}
export interface ToolData {
  get_financial_summary: Summary;
  get_budget_status: BudgetRow[];
  get_goal_progress: GoalRow[];
  get_spending_trends: {
    current: Summary;
    previous: Summary;
    expenseChange: number;
    comparable: boolean;
  };
  get_category_breakdown: CategoryRow[];
  get_recurring_expenses: { candidates: CategoryRow[]; total: number; inferred: true };
  get_recent_transactions: { amount: number; category: string; type: string; date: string }[];
  simulate_savings_plan: Simulation;
  simulate_goal_change: Simulation;
  search_finance_knowledge: {
    id: string;
    excerpt: string;
    source: string;
    indexedAt?: string;
    educational: true;
  }[];
}
export type Evidence =
  | {
      [K in ToolName]: {
        id: string;
        tool: K;
        status: 'ok';
        source: string;
        observedAt: string;
        data: ToolData[K];
      };
    }[ToolName]
  | {
      id: string;
      tool: ToolName;
      status: 'error';
      source: string;
      observedAt: string;
      error: 'TIMEOUT' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE';
    };
export interface Finding {
  id: string;
  text: string;
  evidenceIds: string[];
}
export interface AdvisorResponse {
  summary: string;
  financial_health:
    | 'stable'
    | 'attention'
    | 'insufficient_evidence'
    | 'educational'
    | 'unsupported';
  evidence: Evidence[];
  recommendations: Finding[];
  tools_used: ToolName[];
  assumptions: string[];
  confidence: number;
  simulations: Simulation[];
  provider: 'mock' | 'openai' | 'mock_fallback';
}
export interface FinanceTools {
  call<K extends ToolName>(
    name: K,
    input: { query?: string; simulation?: SimulationInput },
    signal: AbortSignal
  ): Promise<ToolData[K]>;
}
