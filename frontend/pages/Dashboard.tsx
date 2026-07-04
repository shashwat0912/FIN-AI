import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '../lib/api';
import { Transaction } from '../types';
import { logger } from '../utils/logger';

interface TransactionAnalytics {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  topCategories: Array<{ category: string; amount: number }>;
  transactionCount: number;
  period: string;
}

const emptyAnalytics: TransactionAnalytics = {
  totalIncome: 0,
  totalExpenses: 0,
  netAmount: 0,
  topCategories: [],
  transactionCount: 0,
  period: '30 days',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatPercent = (value: number) =>
  `${Math.round(value).toLocaleString('en-IN')}%`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));

const formatPeriodRange = (endDate: Date, period: string) => {
  const days = Number.parseInt(period, 10) || 30;
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);

  return `${formatDate(startDate.toISOString())} - ${formatDate(endDate.toISOString())}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<TransactionAnalytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsResponse, transactionsResponse] = await Promise.all([
        apiClient.getTransactionAnalytics('30'),
        apiClient.getTransactions(1, 6),
      ]);

      setAnalytics({ ...emptyAnalytics, ...analyticsResponse });
      setTransactions(transactionsResponse.data || []);
    } catch (error) {
      logger.error('Failed to load dashboard', error instanceof Error ? error : undefined);
      setError('Could not load your financial brief. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const data = analytics || emptyAnalytics;
  const hasTransactions = data.transactionCount > 0 || transactions.length > 0;
  const topCategory = data.topCategories[0];
  const topCategoryShare = topCategory && data.totalExpenses > 0
    ? (topCategory.amount / data.totalExpenses) * 100
    : 0;
  const isCashflowPositive = data.netAmount >= 0;

  const statusLabel = !hasTransactions
    ? 'No activity recorded'
    : isCashflowPositive
      ? 'Cashflow positive'
      : 'Cashflow negative';
  const statusClass = !hasTransactions
    ? 'border-zinc-700 bg-zinc-800/60 text-zinc-300'
    : isCashflowPositive
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : 'border-red-400/20 bg-red-400/10 text-red-300';

  const heroLine = useMemo(() => {
    if (loading) {
      return {
        first: 'Preparing your financial brief',
        second: '',
      };
    }

    if (!hasTransactions) {
      return {
        first: 'No transactions recorded',
        second: `over the last ${data.period}`,
      };
    }

    return {
      first: `${formatCurrency(Math.abs(data.netAmount))} ${isCashflowPositive ? 'net cashflow' : 'net outflow'}`,
      second: `over the last ${data.period}`,
    };
  }, [data.netAmount, data.period, hasTransactions, isCashflowPositive, loading]);

  const cashflowFact = useMemo(() => {
    if (!hasTransactions) {
      return 'Add transactions to generate a financial brief.';
    }

    if (data.totalIncome > 0 && data.totalExpenses > 0) {
      if (data.totalIncome >= data.totalExpenses) {
        const percent = ((data.totalIncome - data.totalExpenses) / data.totalExpenses) * 100;
        return `Income exceeded expenses by ${formatPercent(percent)}.`;
      }

      const percent = ((data.totalExpenses - data.totalIncome) / data.totalIncome) * 100;
      return `Expenses exceeded income by ${formatPercent(percent)}.`;
    }

    if (data.totalIncome > 0) {
      return `${formatCurrency(data.totalIncome)} income was recorded with no expenses.`;
    }

    if (data.totalExpenses > 0) {
      return `${formatCurrency(data.totalExpenses)} expenses were recorded with no income.`;
    }

    return 'No income or expense records are available yet.';
  }, [data.totalExpenses, data.totalIncome, hasTransactions]);

  const driverFact = topCategory
    ? `${topCategory.category} accounted for ${formatPercent(topCategoryShare)} of recorded spending.`
    : 'No spending driver is available yet.';

  const nextAction = useMemo(() => {
    if (topCategory) {
      return {
        title: `Review ${topCategory.category} spending`,
        detail: `${topCategory.category} is the largest recorded expense category this month.`,
        cta: `Ask why ${topCategory.category} is highest`,
        action: () => navigate('/dashboard/ai-advisor'),
      };
    }

    return {
      title: 'Review recent transactions',
      detail: 'Start by reviewing your latest recorded activity.',
      cta: 'Review transactions',
      action: () => navigate('/dashboard/transactions'),
    };
  }, [navigate, topCategory]);

  const metricItems = [
    { label: 'Income', value: formatCurrency(data.totalIncome), tone: 'text-emerald-300' },
    { label: 'Expenses', value: formatCurrency(data.totalExpenses), tone: 'text-red-300' },
    {
      label: 'Net cashflow',
      value: `${data.netAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(data.netAmount))}`,
      tone: data.netAmount >= 0 ? 'text-emerald-300' : 'text-red-300',
      featured: true,
    },
    { label: 'Transactions', value: data.transactionCount.toLocaleString('en-IN'), tone: 'text-zinc-100' },
  ];

  const categoryItems = data.topCategories.slice(0, 3);
  const recentItems = transactions.slice(0, 6);
  const showConcentrationNote = Boolean(topCategory && topCategoryShare >= 40);
  const latestTransactionDate = transactions.reduce<Date | null>((latest, transaction) => {
    const date = new Date(transaction.date);
    return !latest || date > latest ? date : latest;
  }, null);
  const periodRange = formatPeriodRange(latestTransactionDate || new Date(), data.period);

  return (
    <div className="mx-auto w-full max-w-[1440px] text-white">
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch">
          <div className="min-w-0 lg:w-[64%]">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusClass}`}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current align-middle" />
                {statusLabel}
              </span>
              <span className="text-sm text-zinc-500">{periodRange}</span>
            </div>

            <div className="mt-7 max-w-4xl">
              <p className="font-display text-4xl font-bold leading-tight tracking-tight text-white tabular-nums md:text-5xl">
                {heroLine.first}
                {heroLine.second && (
                  <>
                    <br />
                    {heroLine.second}
                  </>
                )}
              </p>
              <p className="mt-6 max-w-4xl text-base leading-relaxed text-zinc-400">
                {loading ? 'Loading recorded cashflow and spending drivers.' : `${cashflowFact} ${driverFact}`}
              </p>
            </div>

            <div className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {metricItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-5 py-4 ${item.featured ? 'border-emerald-500/30 bg-emerald-500/[0.07]' : 'border-zinc-800 bg-zinc-950/45'}`}
                >
                  <p className="text-sm text-zinc-400">{item.label}</p>
                  <p className={`mt-2 text-xl font-semibold tabular-nums ${item.tone}`}>
                    {loading ? '...' : item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <aside className="flex h-full min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-7 lg:w-[36%] lg:p-8">
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <p className="text-base font-semibold text-emerald-300">Next action</p>
                <h2 className="mt-5 font-display text-[28px] font-semibold leading-tight tracking-tight text-white">
                  {loading ? 'Preparing recommendation' : nextAction.title}
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                  {loading ? 'FinanceAI will use recorded transaction data.' : nextAction.detail}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={nextAction.action}
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-base font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Loading' : nextAction.cta}
                  {!loading && <ArrowRight size={15} />}
                </button>
                <p className="mt-5 text-sm leading-relaxed text-zinc-500">
                  Based on recorded transactions only.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-8">
          <div>
            <h2 className="font-display text-[28px] font-semibold tracking-tight text-white">Why this happened</h2>
            <p className="mt-2 text-base text-zinc-400">Recorded spending drivers for the last {data.period}.</p>
          </div>

          <div className="mt-8 space-y-6">
            {loading ? (
              <p className="text-sm text-zinc-500">Loading spending drivers.</p>
            ) : categoryItems.length > 0 ? (
              categoryItems.map((item, index) => {
                const share = data.totalExpenses > 0 ? (item.amount / data.totalExpenses) * 100 : 0;
                return (
                  <div key={item.category}>
                    <div className="mb-2 flex items-baseline justify-between gap-4">
                      <span className="text-lg font-semibold text-zinc-100">{item.category}</span>
                      <span className="text-base font-semibold tabular-nums text-zinc-200">
                        {formatPercent(share)} · {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${index === 0 ? 'bg-emerald-400' : 'bg-zinc-500'}`}
                        style={{ width: `${Math.max(4, share)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-relaxed text-zinc-500">
                No expense categories were recorded in the last {data.period}.
              </p>
            )}

            {showConcentrationNote && topCategory && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5">
                <p className="text-base leading-relaxed text-amber-100/90">
                  {topCategory.category} concentration is high this month. Review {topCategory.category} transactions before changing budgets.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-[28px] font-semibold tracking-tight text-white">Recent activity</h2>
              <p className="mt-2 text-base text-zinc-400">Latest recorded transactions</p>
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-600">{data.transactionCount.toLocaleString('en-IN')} total</p>
          </div>

          <div className="mt-7">
            {loading ? (
              <p className="text-sm text-zinc-500">Loading recent activity.</p>
            ) : recentItems.length > 0 ? (
              recentItems.map((transaction) => {
                const isIncome = transaction.type === 'INCOME';
                return (
                  <div
                    key={transaction.id}
                    className="border-b border-zinc-800 py-5 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-zinc-100">{transaction.description}</p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {transaction.category} · {formatDate(transaction.date)}
                        </p>
                      </div>
                      <p className={`shrink-0 text-lg font-semibold tabular-nums ${isIncome ? 'text-emerald-300' : 'text-red-300'}`}>
                        {isIncome ? '+' : '-'}
                        {formatCurrency(Number(transaction.amount))}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-sm font-medium text-zinc-300">No transactions yet</p>
                <p className="mt-1 text-sm text-zinc-500">Start by logging your first transaction.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
