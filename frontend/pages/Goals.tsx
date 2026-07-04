import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Calendar } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';

interface Goal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export default function Goals() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form state for adding/editing goal
  const [goalForm, setGoalForm] = useState({
    name: '',
    description: '',
    targetAmount: '',
    currentAmount: '',
    targetDate: '',
    status: 'ACTIVE' as 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED',
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getGoals();
      setGoals(response.data);
    } catch (error: any) {
      logger.error('Error loading goals', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const goalData = {
        name: goalForm.name,
        description: goalForm.description,
        targetAmount: parseFloat(goalForm.targetAmount),
        currentAmount: parseFloat(goalForm.currentAmount),
        targetDate: goalForm.targetDate || undefined,
        status: goalForm.status,
      };

      if (editingGoal) {
        // Update existing goal
        await apiClient.updateGoal(editingGoal.id, goalData);
        setEditingGoal(null);
      } else {
        // Create new goal
        await apiClient.createGoal(goalData);
      }

      // Reset form
      setGoalForm({
        name: '',
        description: '',
        targetAmount: '',
        currentAmount: '',
        targetDate: '',
        status: 'ACTIVE',
      });
      setShowAddForm(false);
      loadGoals();
    } catch (error: any) {
      logger.error('Error saving goal', error);
      setError(error.message);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      description: goal.description || '',
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      targetDate: goal.targetDate || '',
      status: goal.status,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('confirm-delete-goal'))) {
      try {
        await apiClient.deleteGoal(id);
        loadGoals();
      } catch (error: any) {
        logger.error('Error deleting goal', error);
        setError(error.message);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
      case 'COMPLETED': return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
      case 'PAUSED': return 'border-amber-400/20 bg-amber-500/10 text-amber-300';
      case 'CANCELLED': return 'border-red-400/20 bg-red-500/10 text-red-300';
      default: return 'border-zinc-700 bg-zinc-900 text-zinc-400';
    }
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Goals</h1>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">Track progress toward your financial milestones.</p>
        </div>
        <button
          onClick={() => {
            setEditingGoal(null);
            setShowAddForm(true);
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {t('add-new-goal')}
        </button>
      </div>

      {/* Add/Edit Goal Form */}
      {showAddForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            {editingGoal ? t('edit-goal') : t('add-new-goal')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('goal-name')}</label>
                <input
                  type="text"
                  required
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder={t('goal-name-placeholder')}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('status')}</label>
                <select
                  value={goalForm.status}
                  onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as any })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                >
                  <option value="ACTIVE">{t('active')}</option>
                  <option value="PAUSED">{t('paused')}</option>
                  <option value="COMPLETED">{t('completed')}</option>
                  <option value="CANCELLED">{t('cancelled')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('target-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('current-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={goalForm.currentAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                  placeholder="25000"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('target-date')}</label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('description')}</label>
              <textarea
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                rows={3}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                placeholder={t('describe-goal')}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                {editingGoal ? t('update-goal') : t('create-goal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingGoal(null);
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

      {/* Goals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-b-emerald-400"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const progress = getProgressPercentage(goal.currentAmount, goal.targetAmount);
            return (
              <div key={goal.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 hover:bg-zinc-900/60">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-zinc-100">{goal.name}</h3>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(goal.status)}`}>
                        {goal.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-zinc-500 hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {goal.description && (
                  <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-500">{goal.description}</p>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-zinc-500">{t('progress')}</span>
                    <span className="font-medium tabular-nums text-zinc-200">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${goal.status === 'PAUSED' ? 'bg-amber-400' : goal.status === 'CANCELLED' ? 'bg-red-500' : 'bg-emerald-400'}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate tabular-nums text-zinc-500">₹{goal.currentAmount.toLocaleString()}</span>
                    <span className="min-w-0 truncate text-right tabular-nums text-zinc-500">₹{goal.targetAmount.toLocaleString()}</span>
                  </div>
                </div>

                {goal.targetDate && (
                  <div className="mt-4 flex items-center text-sm text-zinc-500">
                    <Calendar className="mr-2 h-4 w-4 shrink-0" />
                    {t('target')}: {new Date(goal.targetDate).toLocaleDateString()}
                  </div>
                )}

                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-500">{t('remaining')}</span>
                    <span className="truncate text-right font-semibold tabular-nums text-zinc-100">
                      ₹{(goal.targetAmount - goal.currentAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && goals.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center sm:p-10">
          <h3 className="text-base font-semibold text-zinc-200">No goals yet</h3>
          <p className="mt-2 text-sm text-zinc-500">Create your first financial goal.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('create-first-goal-button')}
          </button>
        </div>
      )}
    </div>
  );
}
