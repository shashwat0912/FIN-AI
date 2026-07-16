import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { apiClient } from '../lib/api';
import { Transaction } from '../types';
import { logger } from '../utils/logger';
import { onTransactionsUpdated } from '../lib/appEvents';
import { Amount, Button, EmptyState, FolioHeader, InlineNotice } from '../components/ui/PrivateLedger';

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

const formatPercent = (value: number) => `${Math.round(value).toLocaleString('en-IN')}%`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(date));

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

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsResponse, transactionsResponse] = await Promise.all([
        apiClient.getTransactionAnalytics('30'),
        apiClient.getTransactions(1, 6),
      ]);

      setAnalytics({ ...emptyAnalytics, ...analyticsResponse });
      setTransactions(transactionsResponse.data || []);
    } catch (requestError) {
      logger.error('Failed to load dashboard', requestError instanceof Error ? requestError : undefined);
      setError('Could not load your financial brief. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    return onTransactionsUpdated(loadDashboard);
  }, [loadDashboard]);

  const data = analytics || emptyAnalytics;
  const hasTransactions = data.transactionCount > 0 || transactions.length > 0;
  const topCategory = data.topCategories[0];
  const topCategoryShare = topCategory && data.totalExpenses > 0
    ? (topCategory.amount / data.totalExpenses) * 100
    : 0;
  const isCashflowPositive = data.netAmount >= 0;

  const finding = useMemo(() => {
    if (!hasTransactions) return 'No transactions have been recorded yet.';
    if (data.totalIncome > 0 && data.totalExpenses > 0) {
      return isCashflowPositive
        ? `You retained ${formatCurrency(data.netAmount)} after recorded spending.`
        : `Recorded spending exceeded income by ${formatCurrency(Math.abs(data.netAmount))}.`;
    }
    if (data.totalIncome > 0) return `You recorded ${formatCurrency(data.totalIncome)} in income.`;
    return `You recorded ${formatCurrency(data.totalExpenses)} in expenses.`;
  }, [data.netAmount, data.totalExpenses, data.totalIncome, hasTransactions, isCashflowPositive]);

  const cashflowFact = useMemo(() => {
    if (!hasTransactions) return 'Add transactions to generate a financial brief.';
    if (data.totalIncome > 0 && data.totalExpenses > 0) {
      const difference = Math.abs(data.totalIncome - data.totalExpenses);
      const comparison = Math.min(data.totalIncome, data.totalExpenses);
      const percent = comparison > 0 ? (difference / comparison) * 100 : 0;
      return data.totalIncome >= data.totalExpenses
        ? `Income exceeded expenses by ${formatPercent(percent)}.`
        : `Expenses exceeded income by ${formatPercent(percent)}.`;
    }
    if (data.totalIncome > 0) return 'No expenses were recorded in this period.';
    if (data.totalExpenses > 0) return 'No income was recorded in this period.';
    return 'No income or expense records are available yet.';
  }, [data.totalExpenses, data.totalIncome, hasTransactions]);

  const driverFact = topCategory
    ? `${topCategory.category} accounted for ${formatPercent(topCategoryShare)} of recorded expenses.`
    : 'No spending driver is available yet.';

  const nextAction = useMemo(() => {
    if (topCategory) {
      return {
        title: `Review ${topCategory.category} spending`,
        detail: `${topCategory.category} is the largest recorded expense category in this period.`,
        cta: `Ask about ${topCategory.category}`,
        action: () => navigate('/dashboard/ai-advisor'),
      };
    }

    return {
      title: 'Review recent transactions',
      detail: 'Start by checking the latest activity recorded in your ledger.',
      cta: 'Review transactions',
      action: () => navigate('/dashboard/transactions'),
    };
  }, [navigate, topCategory]);

  const latestTransactionDate = transactions.reduce<Date | null>((latest, transaction) => {
    const date = new Date(transaction.date);
    return !latest || date > latest ? date : latest;
  }, null);
  const periodRange = formatPeriodRange(latestTransactionDate || new Date(), data.period);
  const categoryItems = data.topCategories.slice(0, 3);
  const recentItems = transactions.slice(0, 6);
  const showConcentrationNote = Boolean(topCategory && topCategoryShare >= 40);
  const metricItems = [
    { label: 'Income', value: formatCurrency(data.totalIncome), tone: 'text-accent' },
    { label: 'Expenses', value: formatCurrency(data.totalExpenses), tone: 'text-negative' },
    {
      label: 'Net movement',
      value: `${data.netAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(data.netAmount))}`,
      tone: data.netAmount >= 0 ? 'text-ink' : 'text-negative',
    },
    { label: 'Transactions', value: data.transactionCount.toLocaleString('en-IN'), tone: 'text-ink' },
  ];

  return (
    <div className="space-y-8" aria-busy={loading}>
      <FolioHeader
        title="Dashboard"
        description={periodRange}
        action={(
          <Button onClick={() => navigate('/dashboard/transactions?add=1')} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add transaction
          </Button>
        )}
      />

      {error && (
        <InlineNotice action={<Button variant="secondary" onClick={loadDashboard}>Retry</Button>}>
          {error}
        </InlineNotice>
      )}

      <section className="grid gap-7 border-b border-ledger-border pb-8 lg:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)] lg:gap-10">
        <div className="min-w-0">
          {loading ? (
            <div role="status" aria-label="Loading financial brief" className="animate-pulse motion-reduce:animate-none">
              <div className="h-10 w-full max-w-2xl rounded-status bg-ledger-border" />
              <div className="mt-4 h-4 w-full max-w-xl rounded-status bg-ledger-border" />
            </div>
          ) : (
            <>
              <h2 className="max-w-[24ch] text-[2rem] font-semibold leading-[1.15] tracking-[-0.035em] text-ink tabular-nums sm:text-[2.625rem]">
                {finding}
              </h2>
              <p className="mt-4 max-w-[68ch] text-sm leading-6 text-ink-secondary sm:text-base sm:leading-7">
                {cashflowFact} {driverFact}
              </p>
            </>
          )}
        </div>

        <aside className="border-t border-ledger-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
          <p className="text-sm font-medium text-accent">Next action</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-ink">
            {loading ? 'Preparing recommendation' : nextAction.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            {loading ? 'Using recorded transaction data.' : nextAction.detail}
          </p>
          <button
            type="button"
            onClick={nextAction.action}
            disabled={loading}
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent transition-[color,transform] duration-150 ease-out hover:text-accent-hover active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            {loading ? 'Loading' : nextAction.cta}
            {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </aside>
      </section>

      <section aria-label="Period totals" className="grid grid-cols-2 border-y border-ledger-border sm:grid-cols-4">
        {metricItems.map((item, index) => (
          <div
            key={item.label}
            className={`min-w-0 px-4 py-5 first:pl-0 last:pr-0 sm:px-5 ${
              index % 2 === 1 ? 'border-l border-ledger-border' : ''
            } ${index >= 2 ? 'border-t border-ledger-border sm:border-t-0' : ''} ${
              index > 0 ? 'sm:border-l sm:border-ledger-border' : ''
            }`}
          >
            <p className="text-sm text-ink-secondary">{item.label}</p>
            {loading ? (
              <div className="ml-auto mt-3 h-5 w-24 animate-pulse rounded-status bg-ledger-border motion-reduce:animate-none" />
            ) : (
              <p className={`mt-2 text-right text-xl font-semibold tabular-nums lining-nums sm:text-2xl ${item.tone}`}>
                {item.value}
              </p>
            )}
          </div>
        ))}
      </section>

      <div className="grid divide-y divide-ledger-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section className="pb-8 lg:pb-0 lg:pr-10" aria-labelledby="spending-drivers-heading">
          <h2 id="spending-drivers-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Spending drivers</h2>
          <p className="mt-1 text-sm text-ink-secondary">Recorded expenses for the last {data.period}.</p>

          <div className="mt-5">
            {loading ? (
              <div className="space-y-3" role="status" aria-label="Loading spending drivers">
                {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse border-b border-ledger-border bg-ledger-surface motion-reduce:animate-none" />)}
              </div>
            ) : categoryItems.length > 0 ? (
              categoryItems.map((item) => {
                const share = data.totalExpenses > 0 ? (item.amount / data.totalExpenses) * 100 : 0;
                return (
                  <div key={item.category} className="flex items-baseline justify-between gap-4 border-b border-ledger-border py-4">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{item.category}</span>
                    <span className="shrink-0 text-right text-sm tabular-nums text-ink-secondary">
                      {formatPercent(share)} <span className="ml-3 text-ink">{formatCurrency(item.amount)}</span>
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyState title="No spending recorded" description={`No expense categories were recorded in the last ${data.period}.`} />
            )}

            {showConcentrationNote && topCategory && (
              <p className="border-b border-ledger-border py-4 text-sm leading-6 text-warning">
                {topCategory.category} is concentrated in this period. Review those transactions before changing budgets.
              </p>
            )}
          </div>
        </section>

        <section className="pt-8 lg:pl-10 lg:pt-0" aria-labelledby="recent-activity-heading">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 id="recent-activity-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Recent activity</h2>
              <p className="mt-1 text-sm text-ink-secondary">Latest recorded transactions.</p>
            </div>
            <p className="text-sm tabular-nums text-ink-secondary">{data.transactionCount.toLocaleString('en-IN')} total</p>
          </div>

          <div className="mt-5">
            {loading ? (
              <div className="space-y-3" role="status" aria-label="Loading recent activity">
                {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse border-b border-ledger-border bg-ledger-surface motion-reduce:animate-none" />)}
              </div>
            ) : recentItems.length > 0 ? (
              recentItems.map((transaction) => (
                <div key={transaction.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-ledger-border py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{transaction.description}</p>
                    <p className="mt-1 truncate text-xs text-ink-secondary">{transaction.category} <span className="mx-1">/</span> {formatDate(transaction.date)}</p>
                  </div>
                  <Amount amount={Number(transaction.amount)} type={transaction.type} className="self-center text-base" />
                </div>
              ))
            ) : (
              <EmptyState title="No transactions yet" description="Start by logging the first item in your ledger." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
