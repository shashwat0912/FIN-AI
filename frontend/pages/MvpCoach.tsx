import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { dispatchTransactionsUpdated } from '../lib/appEvents';

type MvpInsight = {
  id: string;
  type: string;
  category?: string;
  title: string;
  description: string;
  impact: {
    monthly: number;
    yearly: number;
  };
  confidence: number;
  priorityScore: number;
  createdAt: string;
};

type MvpTransaction = {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: string;
  date: string;
};

type MvpCoachPayload = {
  message: string;
  transaction: MvpTransaction;
  insights: MvpInsight[];
};

type RiskLevel = 'low' | 'medium' | 'high';

type ChatItem =
  | {
      id: string;
      role: 'user';
      text: string;
    }
  | {
      id: string;
      role: 'assistant';
      text: string;
      transaction: MvpTransaction;
      insights: MvpInsight[];
    };

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function normalizeCategory(category: string): string {
  return category.trim() || 'Others';
}

function buildProjection(transaction: MvpTransaction): number {
  return transaction.amount * 30;
}

function getSuggestedMonthlyBudget(category: string, amount: number): number {
  const normalized = normalizeCategory(category).toLowerCase();
  const baseCaps: Record<string, number> = {
    food: 4000,
    transport: 3000,
    entertainment: 2500,
    others: 3500,
  };

  const baseline = baseCaps[normalized] || 3500;
  const spendBasedCap = Math.ceil((amount * 10) / 500) * 500;

  return Math.max(baseline, spendBasedCap);
}

function getRiskLevel(repeatedMonthly: number, detectedMonthlyImpact: number, suggestedBudget: number): RiskLevel {
  const strongestSignal = Math.max(repeatedMonthly, detectedMonthlyImpact);

  if (strongestSignal >= suggestedBudget * 1.4) {
    return 'high';
  }

  if (strongestSignal >= suggestedBudget * 0.85) {
    return 'medium';
  }

  return 'low';
}

function getRiskPalette(level: RiskLevel) {
  if (level === 'high') {
    return {
      badge: 'border-red-400/30 bg-red-500/10 text-red-300',
      panel: 'border-red-300/40 bg-red-50 dark:border-red-400/20 dark:bg-red-500/10',
      eyebrow: 'text-red-700 dark:text-red-300',
      body: 'text-red-900 dark:text-red-100',
      accent: 'text-red-900 dark:text-white',
      label: 'High impact',
    };
  }

  if (level === 'medium') {
    return {
      badge: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
      panel: 'border-amber-300/30 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10',
      eyebrow: 'text-amber-700 dark:text-amber-300',
      body: 'text-amber-900 dark:text-amber-100',
      accent: 'text-amber-900 dark:text-white',
      label: 'Watch this',
    };
  }

  return {
    badge: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    panel: 'border-emerald-300/30 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
    body: 'text-emerald-900 dark:text-emerald-100',
    accent: 'text-emerald-900 dark:text-white',
    label: 'Healthy range',
  };
}

function getCategoryCoachCopy(category: string) {
  const normalized = normalizeCategory(category).toLowerCase();

  if (normalized === 'food') {
    return {
      habitNote: 'Food spends feel small in the moment, but repeat faster than almost any other category.',
      suggestionHint: 'Try a weekly food cap and reserve delivery for a couple of planned meals.',
    };
  }

  if (normalized === 'transport') {
    return {
      habitNote: 'Transport costs usually grow from routine, not one big decision.',
      suggestionHint: 'Set a commute budget and watch for trips that can be bundled or skipped.',
    };
  }

  if (normalized === 'entertainment') {
    return {
      habitNote: 'Entertainment spends stack quietly because each one feels harmless on its own.',
      suggestionHint: 'Give yourself a fixed fun budget so enjoyment stays intentional.',
    };
  }

  if (normalized === 'others') {
    return {
      habitNote: 'Mixed spends are easy to ignore, which is exactly why they drift upward.',
      suggestionHint: 'Move repeat spends into clear categories so they stop hiding in the background.',
    };
  }

  return {
    habitNote: `${normalizeCategory(category)} costs often grow through repetition, not one-off size.`,
    suggestionHint: `Set a simple monthly guardrail for ${normalized} before it becomes background overspend.`,
  };
}

function buildPrimaryInsight(transaction: MvpTransaction, insights: MvpInsight[]) {
  const category = normalizeCategory(transaction.category);
  const primaryInsight = insights[0];
  const repeatedMonthly = buildProjection(transaction);
  const suggestedBudget = getSuggestedMonthlyBudget(category, transaction.amount);
  const detectedMonthlyImpact = primaryInsight?.impact.monthly || 0;
  const budgetPressurePercent = Math.max(1, Math.round((repeatedMonthly / suggestedBudget) * 100));
  const riskLevel = getRiskLevel(repeatedMonthly, detectedMonthlyImpact, suggestedBudget);
  const coachCopy = getCategoryCoachCopy(category);

  return {
    title: primaryInsight?.title || 'Quick money signal',
    description:
      primaryInsight?.description ||
      `You've spent ${formatCurrency(transaction.amount)} on ${category.toLowerCase()} today.`,
    repeatedMonthly,
    detectedMonthlyImpact,
    suggestedBudget,
    budgetPressurePercent,
    riskLevel,
    habitNote: coachCopy.habitNote,
    pressureSummary:
      budgetPressurePercent >= 100
        ? `At this pace, this category alone can run past a healthy monthly budget.`
        : `This spend is still manageable, but repetition will decide whether it stays harmless.`,
    suggestion:
      budgetPressurePercent >= 100
        ? `This pace will likely overshoot a ${formatCurrency(suggestedBudget)}/month ${category.toLowerCase()} budget. ${coachCopy.suggestionHint}`
        : `Try keeping ${category.toLowerCase()} under ${formatCurrency(suggestedBudget)}/month to stay in control. ${coachCopy.suggestionHint}`,
  };
}

export default function MvpCoach() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, dismissedIds]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { id: `${Date.now()}-user`, role: 'user', text }]);
    setLoading(true);
    try {
      const res = await apiClient.post<MvpCoachPayload>('/mvp/chat', { message: text });
      if (!res.success || res.data == null) {
        throw new Error(res.message || 'Request failed');
      }
      dispatchTransactionsUpdated();
      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: res.data.message,
          transaction: res.data.transaction,
          insights: res.data.insights,
        },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const visibleMessages = useMemo(() => messages.filter((message) => {
    if (message.role === 'user') {
      return true;
    }

    return !dismissedIds.includes(message.id);
  }), [dismissedIds, messages]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-1 sm:px-0">
      <div className="space-y-2">
        <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Savings Coach
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Track it once. Feel the impact immediately.</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Log a spend, and this coach turns it into a money signal you can act on right away.
          </p>
        </div>
      </div>

      <div className="min-h-[34rem] rounded-3xl border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-dark-700 dark:bg-dark-900/90 sm:p-4">
        <div className="h-[56vh] min-h-[26rem] space-y-4 overflow-y-auto pr-1 sm:h-[30rem]">
          {visibleMessages.length === 0 && !loading && (
            <div className="flex h-full items-center justify-center">
              <div className="coach-card-enter max-w-md rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center dark:border-dark-600 dark:bg-dark-800/60">
                <div className="text-4xl">💡</div>
                <h2 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">Savings Coach</h2>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                  Start by typing:
                </p>
                <div className="mt-3 rounded-2xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-dark-700">
                  “Spent 400 on burger”
                </div>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  We&apos;ll help you understand where your money is going.
                </p>
              </div>
            </div>
          )}

          {visibleMessages.map((message) => {
            if (message.role === 'user') {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="coach-card-enter max-w-[88%] rounded-3xl rounded-br-md border border-white/5 bg-gray-900 px-4 py-3 text-sm text-white shadow-sm dark:bg-dark-700 sm:max-w-[80%]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">You</div>
                    <div className="mt-1 whitespace-pre-wrap">{message.text}</div>
                  </div>
                </div>
              );
            }

            const primary = buildPrimaryInsight(message.transaction, message.insights);
            const riskPalette = getRiskPalette(primary.riskLevel);

            return (
              <div key={message.id} className="flex justify-start">
                <div className="coach-card-enter w-full max-w-2xl rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-dark-700 dark:bg-dark-800/70">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Coach read</div>
                      <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                        💸 {formatCurrency(message.transaction.amount)} • {normalizeCategory(message.transaction.category)}
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {message.transaction.description}
                      </div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskPalette.badge}`}>
                      {riskPalette.label}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white px-4 py-4 dark:bg-dark-900/80">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Insight
                    </div>
                    <div className="mt-2 text-xl font-semibold leading-8 text-gray-900 dark:text-white">
                      {primary.description}
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {primary.habitNote}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className={`rounded-2xl border px-4 py-3 ${riskPalette.panel}`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${riskPalette.eyebrow}`}>
                          If repeated daily
                        </div>
                        <div className={`mt-2 text-3xl font-semibold tracking-tight ${riskPalette.accent}`}>
                          {formatCurrency(primary.repeatedMonthly)}/month
                        </div>
                        <div className={`mt-1 text-sm ${riskPalette.body}`}>
                          That is {primary.budgetPressurePercent}% of your suggested monthly cap.
                        </div>
                        <div className={`mt-2 text-sm ${riskPalette.body}`}>
                          {primary.pressureSummary}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-dark-700 dark:bg-dark-800/70">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          Suggested cap
                        </div>
                        <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                          {formatCurrency(primary.suggestedBudget)}/month
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          A simple guardrail for {normalizeCategory(message.transaction.category).toLowerCase()}.
                        </div>
                      </div>
                    </div>
                    {primary.detectedMonthlyImpact > 0 && (
                      <div className="mt-4 inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-200">
                        Pattern detected: {formatCurrency(primary.detectedMonthlyImpact)} monthly impact
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-50 px-4 py-4 dark:border-emerald-400/20 dark:bg-emerald-500/10">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                      Suggestion
                    </div>
                    <div className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-50">
                      {primary.suggestion}
                    </div>
                  </div>

                  {message.insights.length > 1 && (
                    <div className="mt-4 space-y-3 rounded-2xl bg-gray-100 px-4 py-3 dark:bg-dark-900/60">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                        More signals
                      </div>
                      {message.insights.slice(1).map((insight) => (
                        <div key={insight.id} className="rounded-2xl border border-gray-200 bg-white px-3 py-3 dark:border-dark-700 dark:bg-dark-800/80">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{insight.title}</div>
                            <div className="rounded-full bg-gray-900/90 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-gray-900">
                              {formatCurrency(insight.impact.monthly)}/mo
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{insight.description}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/budget')}
                      className="rounded-2xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    >
                      Set Budget
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedIds((current) => [...current, message.id]);
                      }}
                      className="rounded-2xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:-translate-y-0.5 hover:bg-gray-100 dark:border-dark-600 dark:text-gray-200 dark:hover:bg-dark-700"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="coach-card-enter max-w-xl rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 shadow-sm dark:border-dark-600 dark:bg-dark-800/60">
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Coach is turning that spend into a money signal...</div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-40 rounded-full bg-gray-200 dark:bg-dark-600 animate-pulse" />
                  <div className="h-10 w-full rounded-2xl bg-gray-200 dark:bg-dark-600 animate-pulse" />
                  <div className="h-20 w-full rounded-2xl bg-gray-200 dark:bg-dark-600 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-3 dark:border-dark-700 dark:bg-dark-900 sm:flex-row sm:items-center">
          <input
            className="flex-1 bg-transparent px-2 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="e.g. spent 400 on burger"
            disabled={loading}
          />
          <button
            type="button"
            className="w-full rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            onClick={() => void send()}
            disabled={loading || input.trim().length === 0}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes coachCardEnter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .coach-card-enter {
          animation: coachCardEnter 220ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .coach-card-enter {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
