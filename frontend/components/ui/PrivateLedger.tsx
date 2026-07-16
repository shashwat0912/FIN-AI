import React, { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8 xl:px-10', className)}>{children}</div>;
}

export function FolioHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-ledger-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[65ch]">
        <h1 className="text-display font-semibold tracking-[-0.025em] text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-6 text-ink-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

const buttonVariants = {
  primary: 'border-accent bg-accent text-surface-strong hover:border-accent-hover hover:bg-accent-hover disabled:border-accent disabled:bg-accent',
  secondary: 'border-border-strong bg-surface-strong text-ink hover:bg-ledger-surface disabled:bg-ledger-surface',
  ghost: 'border-transparent bg-transparent text-ink-secondary hover:bg-accent-soft hover:text-ink',
  danger: 'border-transparent bg-transparent text-negative hover:bg-ledger-surface',
} as const;

export function Button({ variant = 'primary', className, type = 'button', children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border px-4 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        focusRing,
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-transparent text-ink-muted transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] hover:bg-accent-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  helper,
  error,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  helper?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {(helper || error) && (
        <p id={`${htmlFor}-message`} className={cx('mt-1.5 text-xs leading-5', error ? 'text-negative' : 'text-ink-muted')}>
          {error || helper}
        </p>
      )}
    </div>
  );
}

export function LedgerToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-ledger-border py-4 sm:flex-row sm:items-center">{children}</div>;
}

export function InlineNotice({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 border-y border-negative bg-surface-strong px-4 py-3 text-sm text-negative sm:flex-row sm:items-center sm:justify-between">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-b border-ledger-border py-12 text-center sm:py-16">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-6 text-ink-secondary">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function SkeletonRow() {
  return (
    <div className="grid min-h-16 grid-cols-[5.5rem_minmax(0,1.4fr)_minmax(8rem,0.8fr)_7rem_2.75rem] items-center gap-4 border-b border-ledger-border py-3 animate-pulse" aria-hidden="true">
      <div className="h-3 w-16 rounded-status bg-ledger-border" />
      <div className="h-3 w-2/3 rounded-status bg-ledger-border" />
      <div className="h-3 w-1/2 rounded-status bg-ledger-border" />
      <div className="ml-auto h-3 w-20 rounded-status bg-ledger-border" />
      <div className="ml-auto h-7 w-7 rounded-status bg-ledger-border" />
    </div>
  );
}

export function Amount({
  amount,
  type,
  showSign = true,
  className,
  ...props
}: { amount: number; type: string; showSign?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const isExpense = type === 'EXPENSE';
  const sign = showSign ? (isExpense ? '-' : '+') : Number(amount) < 0 ? '-' : '';
  const formatted = `${sign}₹${Math.abs(Number(amount)).toLocaleString('en-IN')}`;

  return (
    <span
      className={cx(
        'whitespace-nowrap font-amount text-sm font-medium tabular-nums lining-nums',
        isExpense ? 'text-negative' : type === 'INCOME' ? 'text-accent' : type === 'NEUTRAL' ? null : 'text-ink-secondary',
        className,
      )}
      {...props}
    >
      {formatted}
    </span>
  );
}
