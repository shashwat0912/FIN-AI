import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { apiClient, type AiHistoryItem } from "../lib/api";
import {
  Button,
  EmptyState,
  FolioHeader,
  InlineNotice,
} from "../components/ui/PrivateLedger";
import { ledgerControlClass } from "../styles/tokens";
import type {
  AdvisorResponse,
  SimulationInput,
  Evidence,
} from "../../backend/src/advisor/types";

const QUESTIONS = [
  "How am I doing financially this month?",
  "Which categories are hurting my budget?",
  "If I reduce dining spend by 25%, how much sooner can I reach my goal?",
];
const money = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
function evidenceLines(e: Evidence): string[] {
  if (e.status === "error")
    return [
      "This source could not be used. Try again or add the missing data.",
    ];
  switch (e.tool) {
    case "get_financial_summary":
      return [
        `Income ${money(e.data.totalIncome)} · Expenses ${money(e.data.totalExpenses)} · Surplus ${money(e.data.netAmount)}`,
        `${e.data.transactionCount} recorded transactions · ${e.data.start.slice(0, 10)} to ${e.data.end.slice(0, 10)}`,
      ];
    case "get_budget_status":
      return e.data.length
        ? e.data.map(
            (b) =>
              `${b.category}: ${money(b.spent)} / ${money(b.amount)} · ${b.status === "UNMAPPED" ? "Category mapping needed" : b.status.replace(/_/g, " ").toLowerCase()}`,
          )
        : ["No active budgets recorded."];
    case "get_goal_progress":
      return e.data.length
        ? e.data.map(
            (g) =>
              `${g.name}: remaining ${money(g.remaining)} · ${g.monthlyRequired === null ? "Deadline needed for a monthly target" : `${money(g.monthlyRequired)} / month required`}`,
          )
        : ["No active goals recorded."];
    case "get_category_breakdown":
      return e.data.map((c) => `${c.category}: ${money(c.amount)}`);
    case "get_spending_trends":
      return [
        e.data.comparable
          ? `Matched-window expense change: ${money(e.data.expenseChange)}`
          : "Not enough history for a matched-window comparison.",
      ];
    case "get_recurring_expenses":
      return [
        `Inferred recurring categories: ${money(e.data.total)} / month. Review before treating these as subscriptions.`,
      ];
    case "get_recent_transactions":
      return e.data.map(
        (t) =>
          `${t.date.slice(0, 10)} · ${t.category} · ${money(t.amount)} ${t.type.toLowerCase()}`,
      );
    case "search_finance_knowledge":
      return e.data.length
        ? e.data.map(
            (k) =>
              `Educational source: ${k.source}. ${k.indexedAt ? `Indexed ${k.indexedAt.slice(0, 10)}; ` : ""}Source publication date unverified.`,
          )
        : ["No sufficient knowledge found."];
    case "simulate_savings_plan":
    case "simulate_goal_change":
      return [
        `Scenario monthly savings: ${money(e.data.scenarioMonthlySavings)}`,
      ];
  }
}
const labels: Record<Evidence["tool"], string> = {
  get_financial_summary: "Recorded cash flow",
  get_budget_status: "Budget limits and spending",
  get_goal_progress: "Goal progress",
  get_category_breakdown: "Spending categories",
  get_spending_trends: "Spending comparison",
  get_recurring_expenses: "Recurring expense candidates",
  get_recent_transactions: "Recent activity",
  search_finance_knowledge: "Educational knowledge",
  simulate_savings_plan: "Savings scenario",
  simulate_goal_change: "Goal scenario",
};
export default function AiAdvisor() {
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const [goals, setGoals] = useState<{ id: string; name: string }[]>([]);
  const [goalId, setGoalId] = useState("");
  useEffect(() => {
    let active = true;
    apiClient
      .getAiHistory()
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => undefined);
    apiClient
      .getGoals(1, 20, "ACTIVE")
      .then((result) => {
        if (active) setGoals(result.data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AdvisorResponse | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<SimulationInput["kind"] | "">("");
  const [value, setValue] = useState("3000");
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || loading) return;
    let simulation: SimulationInput | undefined;
    if (kind)
      simulation =
        kind === "reduce_category"
          ? { kind, percent: Number(value), category: "food-dining" }
          : kind === "change_deadline"
            ? { kind, deadlineMonths: Number(value) }
            : { kind, amount: Number(value) };
    if (simulation && goalId) simulation.goalId = goalId;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getFinanceAdvice({
        question: query.trim(),
        ...(simulation ? { simulation } : {}),
      });
      setAnswer(response);
      setLastQuestion(query.trim());
      setQuery("");
    } catch {
      setError("Could not prepare your financial review. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-8" aria-busy={loading}>
      <FolioHeader
        title="Finance Advisor"
        description="Understand your recorded finances and test a plan before making a decision."
      />
      <form
        onSubmit={handleSubmit}
        className="space-y-4 border-b border-ledger-border pb-6"
      >
        <label
          htmlFor="advisor-question"
          className="block text-sm font-medium text-ink"
        >
          Your financial question
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="advisor-question"
            className={`${ledgerControlClass} min-h-11 min-w-0 sm:flex-1`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={1200}
            minLength={3}
            required
            disabled={loading}
            placeholder="Ask about this month, a budget, or your next goal"
            autoComplete="off"
          />
          <Button type="submit" disabled={loading || query.trim().length < 3}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {loading ? "Reviewing…" : "Ask FinanceAI"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          {QUESTIONS.map((q) => (
            <button
              type="button"
              className="min-h-11 text-left text-sm text-accent underline underline-offset-4 disabled:opacity-50"
              key={q}
              disabled={loading}
              onClick={() => {
                setQuery(q);
                setKind("");
              }}
            >
              {q}
            </button>
          ))}
        </div>
        <details className="text-sm text-ink-secondary">
          <summary className="min-h-11 cursor-pointer py-3">
            Test a financial scenario (optional)
          </summary>
          <p className="mb-3">
            Uses the last complete month and your earliest active goal. No
            account data is changed.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              Scenario
              <select
                aria-label="Scenario"
                className={`${ledgerControlClass} mt-1 w-full`}
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as typeof kind;
                  setKind(k);
                  setValue(
                    k === "reduce_category"
                      ? "20"
                      : k === "change_deadline"
                        ? "6"
                        : "3000",
                  );
                }}
                disabled={loading}
              >
                <option value="">Use question only</option>
                <option value="increase_savings">
                  Increase monthly savings
                </option>
                <option value="reduce_category">Reduce dining spending</option>
                <option value="increase_sip">Increase SIP contribution</option>
                <option value="emergency_expense">
                  Add an emergency expense
                </option>
                <option value="change_deadline">Change goal deadline</option>
              </select>
            </label>
            {kind && (
              <label className="flex-1">
                {kind === "reduce_category"
                  ? "Reduction (%)"
                  : kind === "change_deadline"
                    ? "Months later (negative for earlier)"
                    : "Amount (₹)"}
                <input
                  aria-label="Scenario value"
                  className={`${ledgerControlClass} mt-1 w-full`}
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  min={kind === "change_deadline" ? -120 : 0.01}
                  max={
                    kind === "reduce_category"
                      ? 100
                      : kind === "change_deadline"
                        ? 120
                        : 10000000
                  }
                  step={kind === "change_deadline" ? 1 : "any"}
                  required
                  disabled={loading}
                />
              </label>
            )}
          </div>
          {kind && (
            <label className="mt-3 block">
              Goal
              <select
                aria-label="Scenario goal"
                className={`${ledgerControlClass} mt-1 w-full`}
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                disabled={loading}
              >
                <option value="">Earliest active incomplete goal</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </details>
      </form>
      {error && <InlineNotice>{error}</InlineNotice>}
      {!answer && (
        <EmptyState
          title="Start with a question"
          description="Your review will include the recorded data, practical recommendations, and any assumptions. No paid API is needed in deterministic mode."
        />
      )}
      {answer && (
        <section
          className="space-y-6"
          aria-live="polite"
          aria-labelledby="advisor-answer"
        >
          <div>
            <p className="text-sm text-ink-muted">You asked: {lastQuestion}</p>
            <h2
              id="advisor-answer"
              className="mt-2 text-xl font-semibold text-ink"
            >
              Your financial review
            </h2>
            <p className="mt-2 text-sm capitalize text-accent">
              {answer.financial_health.replace(/_/g, " ")}
            </p>
            <p className="mt-3 max-w-[72ch] text-sm leading-7 text-ink-secondary">
              {answer.summary}
            </p>
          </div>
          {!!answer.recommendations.length && (
            <div>
              <h3 className="font-semibold text-ink">Recommended next steps</h3>
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-ink-secondary">
                {answer.recommendations.map((r) => (
                  <li key={r.id}>
                    {r.text}
                    <span className="ml-2 text-xs text-ink-muted">
                      Based on{" "}
                      {r.evidenceIds
                        .map(
                          (id) =>
                            labels[
                              answer.evidence.find((e) => e.id === id)!.tool
                            ],
                        )
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {answer.simulations.map((s, i) => (
            <div key={i} className="border-y border-ledger-border py-5">
              <h3 className="font-semibold text-ink">Scenario impact</h3>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <dt>Monthly savings capacity</dt>
                <dd>
                  {money(s.baselineMonthlySavings)} →{" "}
                  {money(s.scenarioMonthlySavings)}
                </dd>
                <dt>Goal completion</dt>
                <dd>
                  {s.baselineCompletion || "No finite estimate"} →{" "}
                  {s.scenarioCompletion || "No finite estimate"}
                </dd>
                <dt>Change</dt>
                <dd>
                  {s.monthsEarlier === null
                    ? "No finite comparison"
                    : s.monthsEarlier >= 0
                      ? `${s.monthsEarlier} months earlier`
                      : `${Math.abs(s.monthsEarlier)} months later`}
                </dd>
                {s.kind === "change_deadline" && (
                  <>
                    <dt>Required monthly savings</dt>
                    <dd>
                      {s.requiredMonthlySavings === null
                        ? "No feasible deadline"
                        : money(s.requiredMonthlySavings)}
                    </dd>
                  </>
                )}
              </dl>
              <p className="mt-3 text-sm text-ink-secondary">
                Uses the last complete recorded month, with no returns, taxes or
                inflation assumed. An estimate, not a promised outcome. No money
                has moved.
              </p>
            </div>
          ))}
          <div>
            <h3 className="font-semibold text-ink">Based on your data</h3>
            <ul className="mt-3 space-y-4 text-sm text-ink-secondary">
              {answer.evidence.map((e) => (
                <li key={e.id}>
                  <p className="font-medium text-ink">{labels[e.tool]}</p>
                  {evidenceLines(e).map((line, i) => (
                    <p key={i} className="mt-1">
                      {line}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
          <details className="text-sm text-ink-secondary">
            <summary className="min-h-11 cursor-pointer py-3">
              Assumptions and activity
            </summary>
            <ul className="list-disc space-y-2 pl-5">
              {answer.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-4">
              {answer.provider === "openai"
                ? "OpenAI assisted"
                : answer.provider === "mock_fallback"
                  ? "Deterministic fallback"
                  : "Deterministic mode"}{" "}
              · {answer.tools_used.length} data checks · Evidence confidence{" "}
              {Math.round(answer.confidence * 100)}% (rule-based, not
              calibrated)
            </p>
          </details>
          <p className="text-xs leading-6 text-ink-muted">
            Personal-finance education and planning support. Review your
            obligations and priorities before acting; this service does not
            execute investments or provide regulated advice.
          </p>
        </section>
      )}
      {!!history.length && (
        <details className="text-sm text-ink-secondary">
          <summary className="min-h-11 cursor-pointer py-3">
            Previous advisor conversations
          </summary>
          {history.map((h) => (
            <article key={h.id} className="border-b border-ledger-border py-4">
              <h3 className="font-medium text-ink">{h.query}</h3>
              <p className="mt-2 whitespace-pre-wrap leading-7">{h.response}</p>
            </article>
          ))}
        </details>
      )}
    </div>
  );
}
