import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressLine } from '../../components/ui/FinanceLedger';
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

  it('formats neutral ledger values without a sign', () => {
    render(
      <>
        <Amount amount={12500} type="NEUTRAL" showSign={false} />
        <Amount amount={-800} type="NEUTRAL" showSign={false} />
      </>,
    );

    expect(screen.getByText('₹12,500')).toBeInTheDocument();
    expect(screen.getByText('-₹800')).toBeInTheDocument();
  });
});

describe('Finance ledger progress', () => {
  it('clamps visual progress to the available track', () => {
    render(<ProgressLine value={130} tone="negative" label="Food budget utilisation" />);

    const progress = screen.getByRole('progressbar', { name: 'Food budget utilisation' });
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(progress.firstChild).toHaveStyle({ width: '100%' });
  });
});
