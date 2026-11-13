import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressLine } from '../../components/ui/FinanceLedger';
import { Amount, Field } from '../../components/ui/PrivateLedger';

describe('Private Ledger field', () => {
  it('shows the browser validation message inline, then clears it once the value is valid', () => {
    render(
      <form>
        <Field label="Amount" htmlFor="amount" helper="Rupees and paise.">
          <input id="amount" required defaultValue="" />
        </Field>
      </form>,
    );
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    expect(input).not.toHaveAttribute('aria-invalid');

    const invalid = fireEvent.invalid(input);
    expect(invalid).toBe(false); // tooltip cancelled: the inline message replaces it
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'amount-message');
    const message = document.getElementById('amount-message');
    expect(message).toHaveClass('text-negative');
    expect(message?.textContent).toBe(input.validationMessage || 'Please check this field.');
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: '12.50' } });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(document.getElementById('amount-message')).toHaveTextContent('Rupees and paise.');
  });
});

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
