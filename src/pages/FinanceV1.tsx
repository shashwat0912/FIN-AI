import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  topCategories: { category: string; amount: number }[];
}

export default function FinanceV1() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  // transaction form
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // insight
  const [query, setQuery] = useState('');
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const fetchDashboard = async () => {
    setDashLoading(true);
    try {
      const res = await apiClient.get<DashboardData>('/dashboard');
      if (res.success && res.data) setDashboard(res.data);
    } catch {
      /* keep stale data */
    } finally {
      setDashLoading(false);
    }
  };

  useEffect(() => { void fetchDashboard(); }, []);

  const addTransaction = async () => {
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0 || !txCategory.trim()) {
      setTxStatus('Amount and category are required');
      return;
    }
    setTxStatus(null);
    try {
      const res = await apiClient.post('/transaction', {
        amount,
        type: txType,
        category: txCategory.trim(),
        description: txDesc.trim() || undefined,
      });
      if (res.success) {
        setTxStatus('Transaction added');
        setTxAmount('');
        setTxCategory('');
        setTxDesc('');
        void fetchDashboard();
      } else {
        setTxStatus(res.message || 'Failed');
      }
    } catch (e: unknown) {
      setTxStatus(e instanceof Error ? e.message : 'Error');
    }
  };

  const askInsight = async () => {
    if (!query.trim()) return;
    setInsightLoading(true);
    setInsight(null);
    try {
      const res = await apiClient.post<{ insight: string }>('/insight', { query: query.trim() });
      if (res.success && res.data) setInsight(res.data.insight);
      else setInsight(res.message || 'No insight returned');
    } catch (e: unknown) {
      setInsight(e instanceof Error ? e.message : 'Error');
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Simple Finance AI (V1)</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Lean layer: add transactions, this month&apos;s cashflow, and one AI insight — no agents or RAG.
        </p>
      </div>

      {/* ---- Dashboard metrics ---- */}
      <section className="border border-gray-300 dark:border-gray-600 p-4 space-y-2 text-sm">
        <h2 className="font-medium text-base">This month</h2>
        {dashLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : dashboard ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Income</p>
                <p className="text-lg font-semibold text-green-600">{dashboard.totalIncome}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Expenses</p>
                <p className="text-lg font-semibold text-red-500">{dashboard.totalExpenses}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Savings rate</p>
                <p className="text-lg font-semibold">{(dashboard.savingsRate * 100).toFixed(0)}%</p>
              </div>
            </div>
            {dashboard.topCategories.length > 0 && (
              <div className="pt-2">
                <p className="text-gray-500 dark:text-gray-400 mb-1">Top expense categories</p>
                <ul className="list-disc list-inside">
                  {dashboard.topCategories.map((c) => (
                    <li key={c.category}>{c.category}: {c.amount}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-red-500">Could not load dashboard</p>
        )}
      </section>

      {/* ---- Add transaction ---- */}
      <section className="border border-gray-300 dark:border-gray-600 p-4 space-y-2 text-sm">
        <h2 className="font-medium text-base">Add transaction</h2>
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="block text-gray-500 dark:text-gray-400">Amount</label>
            <input type="number" min="0" className="border px-2 py-1 w-28" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-gray-500 dark:text-gray-400">Type</label>
            <select className="border px-2 py-1" value={txType} onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 dark:text-gray-400">Category</label>
            <input className="border px-2 py-1 w-32" value={txCategory} onChange={(e) => setTxCategory(e.target.value)} placeholder="e.g. food" />
          </div>
          <div>
            <label className="block text-gray-500 dark:text-gray-400">Description</label>
            <input className="border px-2 py-1 w-40" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="optional" />
          </div>
          <button className="border px-3 py-1" onClick={() => void addTransaction()}>Add</button>
        </div>
        {txStatus && <p className="text-xs mt-1">{txStatus}</p>}
      </section>

      {/* ---- AI insight ---- */}
      <section className="border border-gray-300 dark:border-gray-600 p-4 space-y-2 text-sm">
        <h2 className="font-medium text-base">Ask AI</h2>
        <div className="flex gap-2">
          <input
            className="border px-2 py-1 flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void askInsight(); }}
            placeholder="e.g. Where is my money going?"
            disabled={insightLoading}
          />
          <button className="border px-3 py-1" onClick={() => void askInsight()} disabled={insightLoading}>
            {insightLoading ? '...' : 'Ask'}
          </button>
        </div>
        {insight && <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 mt-2">{insight}</pre>}
      </section>
    </div>
  );
}
