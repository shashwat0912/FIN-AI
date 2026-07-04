import React, { useState, useEffect } from 'react';
import { Plus, Filter, Edit3, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: 'MONTHLY' | 'YEARLY' | 'WEEKLY';
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Budget() {
  const { t } = useLanguage();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Form state for adding/editing budget
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    amount: '',
    spent: '',
    period: 'MONTHLY' as 'MONTHLY' | 'YEARLY' | 'WEEKLY',
    isActive: true,
  });

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getBudgets();
      setBudgets(response.data);
    } catch (error: any) {
      logger.error('Error loading budgets', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const budgetData = {
        name: budgetForm.name,
        amount: parseFloat(budgetForm.amount),
        spent: parseFloat(budgetForm.spent),
        period: budgetForm.period,
        isActive: budgetForm.isActive,
      };

      if (editingBudget) {
        await apiClient.updateBudget(editingBudget.id, budgetData);
        setEditingBudget(null);
      } else {
        await apiClient.createBudget(budgetData);
      }

      // Reset form
      setBudgetForm({
        name: '',
        amount: '',
        spent: '',
        period: 'MONTHLY',
        isActive: true,
      });
      setShowAddForm(false);
      loadBudgets();
    } catch (error: any) {
      logger.error('Error saving budget', error);
      setError(error.message);
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setBudgetForm({
      name: budget.name,
      amount: budget.amount.toString(),
      spent: budget.spent.toString(),
      period: budget.period,
      isActive: budget.isActive,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('confirm-delete-budget'))) {
      try {
        await apiClient.deleteBudget(id);
        loadBudgets();
      } catch (error: any) {
        logger.error('Error deleting budget', error);
        setError(error.message);
      }
    }
  };

  const getSpendingPercentage = (spent: number, amount: number) => {
    return Math.min((spent / amount) * 100, 100);
  };

  const getStatusColor = (spent: number, amount: number) => {
    const percentage = getSpendingPercentage(spent, amount);
    if (percentage >= 100) return 'border-red-400/20 bg-red-500/10 text-red-300';
    if (percentage >= 80) return 'border-amber-400/20 bg-amber-500/10 text-amber-300';
    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
  };

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const remainingBudget = totalBudget - totalSpent;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Budget</h1>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">Track category limits and spending progress.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {budgets.length > 0 && (
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 text-sm font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500/40 sm:w-auto">
              <Filter className="h-4 w-4 text-zinc-500" />
              {t('filter')}
            </button>
          )}
          <button
            onClick={() => {
              setEditingBudget(null);
              setShowAddForm(true);
            }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('add-budget')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-sm font-medium text-zinc-500">{t('total-budget')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">₹{totalBudget.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-sm font-medium text-zinc-500">{t('total-spent')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">₹{totalSpent.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="text-sm font-medium text-zinc-500">{t('remaining')}</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${remainingBudget >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            ₹{remainingBudget.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Add/Edit Budget Form */}
      {showAddForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            {editingBudget ? t('edit-budget') : t('add-new-budget')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('budget-name')}</label>
                <input
                  type="text"
                  required
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder={t('budget-name-placeholder')}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('period')}</label>
                <select
                  value={budgetForm.period}
                  onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value as any })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                >
                  <option value="WEEKLY">{t('weekly')}</option>
                  <option value="MONTHLY">{t('monthly')}</option>
                  <option value="YEARLY">{t('yearly')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('budget-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder="15000"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('spent-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={budgetForm.spent}
                  onChange={(e) => setBudgetForm({ ...budgetForm, spent: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder="12000"
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={budgetForm.isActive}
                onChange={(e) => setBudgetForm({ ...budgetForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-400/30"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-zinc-300">
                {t('active-budget')}
              </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                {editingBudget ? t('update-budget') : t('create-budget')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingBudget(null);
                }}
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-6 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
          <p className="text-sm text-red-100">{error}</p>
        </div>
      )}

      {/* Budgets List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-b-emerald-400"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => {
            const spendingPercentage = getSpendingPercentage(budget.spent, budget.amount);
            const remaining = budget.amount - budget.spent;
            
            return (
              <div key={budget.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 hover:bg-zinc-900/60">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-zinc-100">{budget.name}</h3>
                    <p className="mt-1 text-sm capitalize text-zinc-500">{budget.period.toLowerCase()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-500 hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-500">{t('spent')}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(budget.spent, budget.amount)}`}>
                      {spendingPercentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        spendingPercentage >= 100 ? 'bg-red-500' :
                        spendingPercentage >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${spendingPercentage}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-zinc-500">{t('budget')}</p>
                      <p className="truncate font-semibold tabular-nums text-zinc-100">₹{budget.amount.toLocaleString()}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-zinc-500">{t('spent')}</p>
                      <p className="truncate font-semibold tabular-nums text-zinc-100">₹{budget.spent.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-zinc-500">{t('remaining')}</span>
                      <span className={`truncate text-right font-semibold tabular-nums ${remaining >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        ₹{remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {!budget.isActive && (
                    <div className="pt-2">
                      <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-400">
                        {t('inactive')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && budgets.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center sm:p-10">
          <h3 className="text-base font-semibold text-zinc-200">No budgets yet</h3>
          <p className="mt-2 text-sm text-zinc-500">Create a category budget to start tracking spending.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('create-first-budget-button')}
          </button>
        </div>
      )}
    </div>
  );
}
