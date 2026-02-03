import React, { useState, useEffect } from 'react';
import { PieChart, DollarSign, TrendingUp, Plus, BarChart3, Calendar, Filter, Edit3, Trash2 } from 'lucide-react';
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
    if (percentage >= 100) return 'text-red-600 bg-red-100';
    if (percentage >= 80) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const remainingBudget = totalBudget - totalSpent;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('budget-overview')}</h1>
          <p className="text-gray-600 mt-1">{t('monitor-spending')}</p>
        </div>
        <div className="flex space-x-3">
          <button className="inline-flex items-center px-4 py-2 bg-white dark:bg-dark-900 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md">
            <Filter className="w-4 h-4 mr-2" />
            {t('filter')}
          </button>
          <button
            onClick={() => {
              setEditingBudget(null);
              setShowAddForm(true);
            }}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('add-budget')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('total-budget')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalBudget.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('total-spent')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('remaining')}</p>
              <p className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{remainingBudget.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Budget Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
          <h3 className="text-lg font-semibold mb-4">
            {editingBudget ? t('edit-budget') : t('add-new-budget')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('budget-name')}</label>
                <input
                  type="text"
                  required
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                  placeholder={t('budget-name-placeholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('period')}</label>
                <select
                  value={budgetForm.period}
                  onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                >
                  <option value="WEEKLY">{t('weekly')}</option>
                  <option value="MONTHLY">{t('monthly')}</option>
                  <option value="YEARLY">{t('yearly')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('budget-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('spent-amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={budgetForm.spent}
                  onChange={(e) => setBudgetForm({ ...budgetForm, spent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
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
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                {t('active-budget')}
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingBudget ? t('update-budget') : t('create-budget')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingBudget(null);
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

      {/* Budgets List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => {
            const spendingPercentage = getSpendingPercentage(budget.spent, budget.amount);
            const remaining = budget.amount - budget.spent;
            
            return (
              <div key={budget.id} className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 hover:shadow-md transition-shadow duration-200 dark:bg-dark-900">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <PieChart className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{budget.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{budget.period.toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('spent')}</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(budget.spent, budget.amount)}`}>
                      {spendingPercentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-dark-700">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        spendingPercentage >= 100 ? 'bg-red-500' :
                        spendingPercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${spendingPercentage}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{t('budget')}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">₹{budget.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('spent')}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">₹{budget.spent.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-dark-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('remaining')}</span>
                      <span className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{remaining.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {!budget.isActive && (
                    <div className="pt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-dark-800 text-gray-800">
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
        <div className="text-center py-12">
          <PieChart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('no-budgets-yet')}</h3>
          <p className="text-gray-500 mb-6">{t('create-first-budget')}</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('create-first-budget-button')}
          </button>
        </div>
      )}
    </div>
  );
}