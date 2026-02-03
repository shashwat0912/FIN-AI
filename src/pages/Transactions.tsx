import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit3, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('transactions')}</h1>
          <p className="text-gray-600 mt-1">Manage your income and expenses</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('add-transaction')}
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('search-transactions')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div className="relative filter-dropdown">
          <button 
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="px-4 py-2 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 flex items-center bg-white dark:bg-dark-900"
          >
            <Filter className="w-4 h-4 mr-2" />
            {t('filter')} {filterType !== 'ALL' && `(${filterType})`}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showFilterDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-900 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 z-10">
              <div className="py-1">
                <button
                  onClick={() => {
                    setFilterType('ALL');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-800 ${
                    filterType === 'ALL' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
{t('all')} {t('transactions')}
                </button>
                <button
                  onClick={() => {
                    setFilterType('INCOME');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-800 flex items-center ${
                    filterType === 'INCOME' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  {t('income')}
                </button>
                <button
                  onClick={() => {
                    setFilterType('EXPENSE');
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-800 flex items-center ${
                    filterType === 'EXPENSE' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  {t('expense')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6 dark:bg-dark-900">
          <h3 className="text-lg font-semibold mb-4">{t('add-transaction')}</h3>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('amount')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('type')}</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                >
                  <option value="EXPENSE">{t('expense')}</option>
                  <option value="INCOME">{t('income')}</option>
                  <option value="TRANSFER">{t('transfer')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('description')}</label>
                <input
                  type="text"
                  required
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('category')}</label>
                <WorkingCategorySelector
                  selectedCategory={selectedCategory}
                  onCategorySelect={setSelectedCategory}
                  transactionType={newTransaction.type === 'INCOME' ? 'income' : 'expense'}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('date')}</label>
                <input
                  type="date"
                  required
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
{t('add-transaction')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
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

      {/* Transactions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">{t('loading')}</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">{t('no-data')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="p-6 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.type === 'INCOME' ? 'bg-green-100' :
                      transaction.type === 'EXPENSE' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {transaction.type === 'INCOME' ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : transaction.type === 'EXPENSE' ? (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      ) : (
                        <Edit3 className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{transaction.description}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{transaction.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className={`font-semibold ${
                        transaction.type === 'INCOME' ? 'text-green-600' :
                        transaction.type === 'EXPENSE' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {transaction.type === 'EXPENSE' ? '-' : '+'}₹{Number(transaction.amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
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