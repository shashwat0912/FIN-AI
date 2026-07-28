import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Filter, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { Transaction } from '../types';
import WorkingCategorySelector from '../components/transactions/WorkingCategorySelector';
import { Category } from '../data/categories';
import { useLanguage } from '../context/LanguageContext';
import { logger } from '../utils/logger';
import {
  Amount,
  Button,
  EmptyState,
  Field,
  FolioHeader,
  InlineNotice,
  LedgerToolbar,
  SkeletonRow,
} from '../components/ui/PrivateLedger';
import { ledgerControlClass } from '../styles/tokens';
import { onTransactionsUpdated } from '../lib/appEvents';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const signedAmount = (transaction: Transaction) => {
  if (transaction.type === 'INCOME') return Number(transaction.amount);
  if (transaction.type === 'EXPENSE') return -Number(transaction.amount);
  return 0;
};

const formatLedgerPeriod = (transactions: Transaction[]) => {
  if (transactions.length === 0) {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
  }

  const dates = transactions.map((transaction) => new Date(transaction.date)).sort((a, b) => a.getTime() - b.getTime());
  const first = dates[0];
  const last = dates[dates.length - 1];
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();

  if (sameMonth) {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(last);
  }

  const start = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(first);
  const end = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(last);
  return `${start} to ${end}`;
};

export default function Transactions() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(() => searchParams.get('add') === '1');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    description: '',
    category: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'TRANSFER',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const handleTypeChange = (newType: string) => {
    setNewTransaction({ ...newTransaction, type: newType as 'INCOME' | 'EXPENSE' | 'TRANSFER' });
    if (selectedCategory && selectedCategory.type !== (newType === 'INCOME' ? 'income' : 'expense')) {
      setSelectedCategory(null);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getTransactions(1, 50);
      setTransactions(response.data || []);
    } catch (requestError: unknown) {
      logger.error('Error loading transactions', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    return onTransactionsUpdated(loadTransactions);
  }, []);

  const handleAddTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError(null);
      await apiClient.createTransaction({
        amount: Number.parseFloat(newTransaction.amount),
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
    } catch (requestError: unknown) {
      logger.error('Error creating transaction', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Failed to create transaction');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await apiClient.deleteTransaction(id);
      loadTransactions();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete transaction');
    }
  };

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = transaction.description.toLowerCase().includes(query)
      || transaction.category.toLowerCase().includes(query);
    const matchesType = filterType === 'ALL' || transaction.type === filterType;
    return matchesSearch && matchesType;
  }), [filterType, searchTerm, transactions]);

  const totals = useMemo(() => filteredTransactions.reduce((summary, transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.type === 'INCOME') summary.income += amount;
    if (transaction.type === 'EXPENSE') summary.expenses += amount;
    summary.movement += signedAmount(transaction);
    return summary;
  }, { income: 0, expenses: 0, movement: 0 }), [filteredTransactions]);

  const periodLabel = formatLedgerPeriod(filteredTransactions);

  return (
    <div className="space-y-7">
      <FolioHeader
        title={t('transactions')}
        description="Review and manage your recorded activity."
        action={(
          <Button onClick={() => setShowAddForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add transaction
          </Button>
        )}
      />

      {showAddForm && (
        <section aria-labelledby="add-transaction-heading" className="border-y border-ledger-border bg-ledger-surface py-5 sm:px-5 sm:py-6">
          <div className="px-4 sm:px-0">
            <h2 id="add-transaction-heading" className="text-lg font-semibold text-ink">{t('add-transaction')}</h2>
            <p className="mt-1 text-sm text-ink-secondary">Record one item without leaving the ledger.</p>
          </div>

          <form onSubmit={handleAddTransaction} className="mt-5 px-4 sm:px-0">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-12">
              <div className="lg:col-span-2">
                <Field label={t('amount')} htmlFor="transaction-amount" helper="Rupees and paise.">
                  <input
                    id="transaction-amount"
                    type="number"
                    step="0.01"
                    required
                    inputMode="decimal"
                    value={newTransaction.amount}
                    onChange={(event) => setNewTransaction({ ...newTransaction, amount: event.target.value })}
                    aria-describedby="transaction-amount-message"
                    className={ledgerControlClass}
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <Field label={t('type')} htmlFor="transaction-type">
                  <select
                    id="transaction-type"
                    value={newTransaction.type}
                    onChange={(event) => handleTypeChange(event.target.value)}
                    className={ledgerControlClass}
                  >
                    <option value="EXPENSE">{t('expense')}</option>
                    <option value="INCOME">{t('income')}</option>
                    <option value="TRANSFER">{t('transfer')}</option>
                  </select>
                </Field>
              </div>

              <div className="lg:col-span-3">
                <Field label={t('description')} htmlFor="transaction-description">
                  <input
                    id="transaction-description"
                    type="text"
                    required
                    value={newTransaction.description}
                    onChange={(event) => setNewTransaction({ ...newTransaction, description: event.target.value })}
                    className={ledgerControlClass}
                  />
                </Field>
              </div>

              <div className="lg:col-span-3">
                <Field label={t('category')} htmlFor="transaction-category">
                  <WorkingCategorySelector
                    id="transaction-category"
                    selectedCategory={selectedCategory}
                    onCategorySelect={setSelectedCategory}
                    transactionType={newTransaction.type === 'INCOME' ? 'income' : 'expense'}
                    className="w-full"
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <Field label={t('date')} htmlFor="transaction-date">
                  <input
                    id="transaction-date"
                    type="date"
                    required
                    value={newTransaction.date}
                    onChange={(event) => setNewTransaction({ ...newTransaction, date: event.target.value })}
                    className={ledgerControlClass}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="submit">{t('add-transaction')}</Button>
              <Button variant="secondary" onClick={() => setShowAddForm(false)}>{t('cancel')}</Button>
            </div>
          </form>
        </section>
      )}

      {error && (
        <InlineNotice action={<Button variant="secondary" onClick={loadTransactions}>Retry</Button>}>
          {error}
        </InlineNotice>
      )}

      <section className="flex flex-col gap-5 border-b border-ledger-border pb-6 sm:flex-row sm:items-end sm:justify-between" aria-label="Period movement">
        <div>
          <p className="text-sm text-ink-secondary">Period movement</p>
          {loading ? (
            <div className="mt-2 h-9 w-40 animate-pulse rounded-status bg-ledger-border motion-reduce:animate-none" />
          ) : (
            <p className={`mt-1 text-3xl font-semibold tracking-[-0.03em] tabular-nums ${totals.movement < 0 ? 'text-negative' : 'text-ink'}`}>
              {totals.movement >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totals.movement))}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:text-right">
          <div>
            <dt className="text-ink-secondary">Income</dt>
            <dd className="mt-1 font-medium tabular-nums text-accent">{loading ? '…' : formatCurrency(totals.income)}</dd>
          </div>
          <div>
            <dt className="text-ink-secondary">Expenses</dt>
            <dd className="mt-1 font-medium tabular-nums text-negative">{loading ? '…' : formatCurrency(totals.expenses)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="transaction-ledger-heading">
        <LedgerToolbar>
          <label htmlFor="transaction-search" className="sr-only">{t('search-transactions')}</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              id="transaction-search"
              type="search"
              placeholder={t('search-transactions')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${ledgerControlClass} pl-10`}
            />
          </div>

          <div className="relative shrink-0">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <select
              aria-label="Filter transactions by type"
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as typeof filterType)}
              className={`${ledgerControlClass} min-w-52 appearance-none pl-10 pr-10`}
            >
              <option value="ALL">{t('all')} {t('transactions')}</option>
              <option value="INCOME">{t('income')}</option>
              <option value="EXPENSE">{t('expense')}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          </div>
        </LedgerToolbar>

        <div className="flex items-baseline justify-between gap-4 py-5">
          <div>
            <h2 id="transaction-ledger-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">{periodLabel}</h2>
            <p className="mt-1 text-sm text-ink-secondary">Recorded ledger entries</p>
          </div>
          <p className="shrink-0 text-sm tabular-nums text-ink-secondary">{filteredTransactions.length.toLocaleString('en-IN')} entries</p>
        </div>

        {loading ? (
          <div role="status" aria-label={t('loading')}>
            <span className="sr-only">{t('loading')}</span>
            <div className="hidden md:block">
              {Array.from({ length: 6 }).map((_, index) => <SkeletonRow key={index} />)}
            </div>
            <div className="md:hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid min-h-20 grid-cols-[3.25rem_minmax(0,1fr)_5.75rem_2.75rem] items-center gap-2 border-b border-ledger-border py-4 animate-pulse motion-reduce:animate-none" aria-hidden="true">
                  <div className="h-7 w-10 rounded-status bg-ledger-border" />
                  <div className="space-y-2">
                    <div className="h-3 w-2/3 rounded-status bg-ledger-border" />
                    <div className="h-3 w-1/2 rounded-status bg-ledger-border" />
                  </div>
                  <div className="h-3 w-20 rounded-status bg-ledger-border" />
                  <div className="h-7 w-7 rounded-status bg-ledger-border" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title={transactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            description={transactions.length === 0 ? 'Start by logging the first item in your ledger.' : 'Adjust your search or filter to see more of your ledger.'}
            action={transactions.length === 0 ? (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add transaction
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => { setSearchTerm(''); setFilterType('ALL'); }}>
                Clear filters
              </Button>
            )}
          />
        ) : (
          <>
            <div className="hidden md:block" role="table" aria-label="Transactions">
              <div className="grid grid-cols-[7rem_minmax(0,1.4fr)_minmax(9rem,0.8fr)_8rem_2.75rem] gap-4 border-b border-ledger-border py-3 text-caption font-medium uppercase tracking-[0.08em] text-ink-secondary" role="row">
                <span role="columnheader">Date</span>
                <span role="columnheader">Description</span>
                <span role="columnheader">Category</span>
                <span role="columnheader" className="text-right">Amount</span>
                <span role="columnheader" className="sr-only">Actions</span>
              </div>
              <div role="rowgroup">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} role="row" className="group grid min-h-16 grid-cols-[7rem_minmax(0,1.4fr)_minmax(9rem,0.8fr)_8rem_2.75rem] items-center gap-4 border-b border-ledger-border py-3 transition-colors duration-150 hover:bg-ledger-surface focus-within:bg-ledger-surface motion-reduce:transition-none">
                    <time role="cell" className="text-sm tabular-nums text-ink-secondary" dateTime={transaction.date}>
                      {new Date(transaction.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </time>
                    <p role="cell" className="truncate text-sm font-medium text-ink">{transaction.description}</p>
                    <p role="cell" className="truncate text-sm text-ink-secondary">{transaction.category}</p>
                    <Amount role="cell" amount={transaction.amount} type={transaction.type} className="block text-right" />
                    <details className="relative justify-self-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
                      <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted transition-colors duration-150 hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${transaction.description}`}>
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-36 rounded-popover border border-border-strong bg-surface-strong p-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-negative hover:bg-ledger-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:hidden">
              {filteredTransactions.map((transaction) => {
                const date = new Date(transaction.date);
                return (
                  <article key={transaction.id} className="grid min-h-20 grid-cols-[3.25rem_minmax(0,1fr)_5.75rem_2.75rem] items-center gap-2 border-b border-ledger-border py-4">
                    <time dateTime={transaction.date} className="text-center tabular-nums text-ink-secondary">
                      <span className="block text-base font-medium text-ink">{date.toLocaleDateString('en-IN', { day: '2-digit' })}</span>
                      <span className="block text-xs">{date.toLocaleDateString('en-IN', { month: 'short' })}</span>
                    </time>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-ink">{transaction.description}</h3>
                      <p className="mt-1 truncate text-xs text-ink-secondary">{transaction.category}</p>
                    </div>
                    <Amount amount={transaction.amount} type={transaction.type} className="block text-right text-sm" />
                    <details className="relative justify-self-end">
                      <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${transaction.description}`}>
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-36 rounded-popover border border-border-strong bg-surface-strong p-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium text-negative focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>

            <footer className="border-t border-border-strong py-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium text-ink">Period movement</p>
                <p className={`text-lg font-semibold tabular-nums ${totals.movement < 0 ? 'text-negative' : 'text-ink'}`}>
                  {totals.movement >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totals.movement))}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-secondary">Income minus expenses across the ledger entries shown. Transfers do not change movement.</p>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
