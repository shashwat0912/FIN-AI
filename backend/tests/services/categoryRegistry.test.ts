import { describe, expect, it } from 'vitest';
import { expenseCategories, incomeCategories } from '../../../frontend/data/categories';
import { CATEGORY_REGISTRY, normalizeCategory } from '../../src/domain/categoryRegistry';

describe('categoryRegistry', () => {
  it('matches exactly the categories supported by the frontend', () => {
    const frontendCategories = [...incomeCategories, ...expenseCategories]
      .map(({ id: key, name: label, type }) => ({ key, label, type }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const backendCategories = CATEGORY_REGISTRY
      .map(({ key, label, type }) => ({ key, label, type }))
      .sort((a, b) => a.key.localeCompare(b.key));

    expect(backendCategories).toEqual(frontendCategories);
  });

  it('normalizes labels and known aliases without fuzzy guessing', () => {
    expect(normalizeCategory('Food & Dining', 'expense')?.key).toBe('food-dining');
    expect(normalizeCategory('food and dining', 'expense')?.key).toBe('food-dining');
    expect(normalizeCategory('salary', 'income')?.key).toBe('salary-wages');
    expect(normalizeCategory('foood', 'expense')).toBeNull();
    expect(normalizeCategory('Food & Dining', 'income')).toBeNull();
    expect(normalizeCategory('Miscellaneous', 'expense')).toBeNull();
  });
});
