import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabase } from '../../src/scripts/testDatabase';

describe('test database safety guard', () => {
  it('accepts a dedicated PostgreSQL test database', () => {
    expect(
      assertSafeTestDatabase(
        'postgresql://test@localhost:5433/finance_ai_test',
        'test'
      )
    ).toBe('finance_ai_test');
  });

  it.each([
    'postgresql://test@localhost:5432/financeai',
    'postgresql://test@localhost:5432/finance_ai_db',
    'postgresql://test@localhost:5432/finance_ai',
    'file:./test.db',
  ])('rejects unsafe database URL %s', (databaseUrl) => {
    expect(() => assertSafeTestDatabase(databaseUrl, 'test')).toThrow();
  });

  it('requires NODE_ENV=test', () => {
    expect(() =>
      assertSafeTestDatabase(
        'postgresql://test@localhost:5433/finance_ai_test',
        'development'
      )
    ).toThrow('NODE_ENV=test');
  });
});

