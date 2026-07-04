import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Home, Briefcase, Plus, Edit3, Trash2, Calendar, DollarSign } from 'lucide-react';
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
      case 'ACTIVE': return 'text-green-600 bg-green-100';
      case 'COMPLETED': return 'text-blue-600 bg-blue-100';
      case 'PAUSED': return 'text-yellow-600 bg-yellow-100';
      case 'CANCELLED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('financial-goals')}</h1>
          <p className="text-gray-600 mt-1">{t('track-progress')}</p>
        </div>
        <button
          onClick={() => {
            setEditingGoal(null);
            setShowAddForm(true);
          }}
          className="inline-flex w-full items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl sm:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('add-new-goal')}
        </button>
      </div>

      {/* Add/Edit Goal Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
          <h3 className="text-lg font-semibold mb-4">
            {editingGoal ? t('edit-goal') : t('add-new-goal')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('goal-name')}</label>
                <input
                  type="text"
                  required
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                  placeholder={t('goal-name-placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('status')}</label>
                <select
                  value={goalForm.status}
                  onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                >
                  <option value="ACTIVE">{t('active')}</option>
                  <option value="PAUSED">{t('paused')}</option>
                  <option value="COMPLETED">{t('completed')}</option>
                  <option value="CANCELLED">{t('cancelled')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('target-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('current-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={goalForm.currentAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="25000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('target-date')}</label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('description')}</label>
              <textarea
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                placeholder={t('describe-goal')}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingGoal ? t('update-goal') : t('create-goal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingGoal(null);
                }}
                className="px-6 py-2 border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Goals Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {goals.map((goal) => {
            const progress = getProgressPercentage(goal.currentAmount, goal.targetAmount);
            return (
              <div key={goal.id} className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 hover:shadow-md transition-shadow duration-200 dark:bg-dark-900">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Target className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                        {goal.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {goal.description && (
                  <p className="text-gray-600 text-sm mb-4">{goal.description}</p>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('progress')}</span>
                    <span className="font-medium">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-dark-700">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">₹{goal.currentAmount.toLocaleString()}</span>
                    <span className="text-gray-500">₹{goal.targetAmount.toLocaleString()}</span>
                  </div>
                </div>

                {goal.targetDate && (
                  <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    {t('target')}: {new Date(goal.targetDate).toLocaleDateString()}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('remaining')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
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
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('no-goals-yet')}</h3>
          <p className="text-gray-500 mb-6">{t('create-first-goal')}</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('create-first-goal-button')}
          </button>
        </div>
      )}
    </div>
  );
}
