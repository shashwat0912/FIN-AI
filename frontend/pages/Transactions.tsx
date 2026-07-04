import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Trash2 } from 'lucide-react';
import { apiClient, Transaction } from '../lib/api';
import WorkingCategorySelector from '../components/transactions/WorkingCategorySelector';
import { Category } from '../data/categories';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';

export default function Transactions() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Form state for adding new transaction
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    description: '',
    category: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'TRANSFER',
    date: new Date().toISOString().split('T')[0],
  });
  
  // Category state for the enhanced selector
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Handle transaction type change - clear category if it doesn't match new type
  const handleTypeChange = (newType: string) => {
    setNewTransaction({ ...newTransaction, type: newType as any });
    // Clear selected category if it doesn't match the new type
    if (selectedCategory && selectedCategory.type !== (newType === 'INCOME' ? 'income' : 'expense')) {
      setSelectedCategory(null);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFilterDropdown && !(event.target as Element).closest('.filter-dropdown')) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getTransactions(1, 50);
      setTransactions(response.data || []);
    } catch (error: any) {
      logger.error('Error loading transactions', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await apiClient.createTransaction({
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        category: selectedCategory?.name || newTransaction.category,
        type: newTransaction.type,
        date: newTransaction.date,
      });

      setNewTransaction({
        amount: '',
        description: '',
        category: '',
        type: 'EXPENSE',
        date: new Date().toISOString().split('T')[0],
      });
      setSelectedCategory(null);
      setShowAddForm(false);
      loadTransactions();
    } catch (error: any) {
      logger.error('Error creating transaction', error);
      setError(error.message);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await apiClient.deleteTransaction(id);
        loadTransactions();
      } catch (error: any) {
        setError(error.message);
      }
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || transaction.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">{t('transactions')}</h1>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">Review and manage your recorded activity.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add transaction
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={t('search-transactions')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-11 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
          />
        </div>
        <div className="relative filter-dropdown sm:shrink-0">
          <button 
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-medium text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-400/10 sm:w-auto"
          >
            <Filter className="h-4 w-4 text-zinc-500" />
            {t('filter')} {filterType !== 'ALL' && `(${filterType})`}
            <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showFilterDropdown && (
            <div className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="py-1">
                <button
                  onClick={() => {
                    setFilterType('ALL');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-900 ${
                    filterType === 'ALL' ? 'bg-zinc-900 text-white' : 'text-zinc-400'
                  }`}
                >
                  {t('all')} {t('transactions')}
                </button>
                <button
                  onClick={() => {
                    setFilterType('INCOME');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-900 ${
                    filterType === 'INCOME' ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-400'
                  }`}
                >
                  {t('income')}
                </button>
                <button
                  onClick={() => {
                    setFilterType('EXPENSE');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-900 ${
                    filterType === 'EXPENSE' ? 'bg-red-500/10 text-red-300' : 'text-zinc-400'
                  }`}
                >
                  {t('expense')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">{t('add-transaction')}</h3>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('type')}</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                >
                  <option value="EXPENSE">{t('expense')}</option>
                  <option value="INCOME">{t('income')}</option>
                  <option value="TRANSFER">{t('transfer')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('description')}</label>
                <input
                  type="text"
                  required
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('category')}</label>
                <WorkingCategorySelector
                  selectedCategory={selectedCategory}
                  onCategorySelect={setSelectedCategory}
                  transactionType={newTransaction.type === 'INCOME' ? 'income' : 'expense'}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">{t('date')}</label>
                <input
                  type="date"
                  required
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 hover:border-zinc-700 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
              >
                {t('add-transaction')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
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

      {/* Transactions List */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
        {loading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-b-emerald-400"></div>
            <p className="mt-3 text-sm text-zinc-500">{t('loading')}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center sm:p-10">
            <p className="text-base font-semibold text-zinc-200">No transactions yet</p>
            <p className="mt-2 text-sm text-zinc-500">Start by logging your first transaction.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add transaction
            </button>
          </div>
        ) : (
          <div>
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="border-b border-zinc-800/80 px-4 py-4 last:border-b-0 hover:bg-white/[0.03] sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-zinc-100">{transaction.description}</h3>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
                      <span className="min-w-0 max-w-full truncate">{transaction.category}</span>
                      <span aria-hidden="true">·</span>
                      <time>{new Date(transaction.date).toLocaleDateString()}</time>
                    </div>
                  </div>
                  <div className="flex max-w-[42%] shrink-0 flex-col items-end gap-2 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
                    <p className={`max-w-full truncate whitespace-nowrap text-right text-base font-semibold tabular-nums ${
                      transaction.type === 'INCOME' ? 'text-emerald-300' :
                      transaction.type === 'EXPENSE' ? 'text-red-300' : 'text-zinc-300'
                    }`}>
                      {transaction.type === 'EXPENSE' ? '-' : '+'}₹{Number(transaction.amount).toLocaleString()}
                    </p>
                    <button
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      aria-label={`Delete ${transaction.description}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-zinc-500 hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300/40 focus-visible:border-red-300/40 focus-visible:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
