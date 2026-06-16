import { CategoryTotals, InsightTransaction, TimeWindow } from '../types';

export function normalizeCategory(category: string | null | undefined): string {
  const normalized = String(category || '').trim();
  return normalized || 'Uncategorized';
}

export function filterTransactionsByWindow(
  transactions: InsightTransaction[],
  window: TimeWindow
): InsightTransaction[] {
  return transactions.filter((transaction) => transaction.date >= window.start && transaction.date <= window.end);
}

export function sumAmounts(transactions: InsightTransaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function aggregateByCategory(
  transactions: InsightTransaction[],
  window: TimeWindow
): CategoryTotals {
  const totals: CategoryTotals = {};

  for (const transaction of filterTransactionsByWindow(transactions, window)) {
    const category = normalizeCategory(transaction.category);
    totals[category] = (totals[category] || 0) + transaction.amount;
  }

  return totals;
}

export function getAllCategories(categoryTotalsList: CategoryTotals[]): string[] {
  const categories = new Set<string>();

  for (const totals of categoryTotalsList) {
    for (const category of Object.keys(totals)) {
      categories.add(category);
    }
  }

  return Array.from(categories).sort();
}

export function buildCategorySeries(
  transactions: InsightTransaction[],
  windows: TimeWindow[]
): Record<string, number[]> {
  const totalsByWindow = windows.map((window) => aggregateByCategory(transactions, window));
  const categories = getAllCategories(totalsByWindow);
  const series: Record<string, number[]> = {};

  for (const category of categories) {
    series[category] = totalsByWindow.map((totals) => totals[category] || 0);
  }

  return series;
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

export function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}
