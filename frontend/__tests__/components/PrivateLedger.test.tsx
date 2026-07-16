import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Amount } from '../../components/ui/PrivateLedger';

describe('Private Ledger amount', () => {
  it('formats income and expenses as signed Indian rupee values', () => {
    render(
      <>
        <Amount amount={68000} type="INCOME" />
        <Amount amount={2840} type="EXPENSE" />
      </>,
    );

    expect(screen.getByText('+₹68,000')).toBeInTheDocument();
    expect(screen.getByText('-₹2,840')).toBeInTheDocument();
  });
});
