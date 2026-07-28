import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import {
  ChatBudgetEntities,
  ChatBulkTransactionEntities,
  ChatTransactionEntities,
  ConfirmationCard as ConfirmationCardType,
} from '../../types';
import { Button, Field } from '../ui/PrivateLedger';

interface ConfirmationCardProps {
  card: ConfirmationCardType;
  onConfirm: () => void;
  onEdit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function ConfirmationCard({ card, onConfirm, onEdit, onCancel, disabled }: ConfirmationCardProps) {
  const isTransaction = card.type === 'transaction';
  const isBulkTransaction = card.type === 'bulk_transaction';
  const transaction = card.data as ChatTransactionEntities;
  const budget = card.data as ChatBudgetEntities;
  const bulk = card.data as ChatBulkTransactionEntities;
  const originalAmount = isTransaction ? transaction.amount : budget.amount;
  const bulkTotal = isBulkTransaction ? bulk.items.reduce((sum, item) => sum + item.amount, 0) : 0;
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(String(originalAmount || ''));
  const [description, setDescription] = useState(isTransaction ? transaction.description || '' : '');
  const [validationError, setValidationError] = useState<{
    field: 'amount' | 'description';
    message: string;
  } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing) return undefined;
    const editButton = editButtonRef.current?.querySelector('button');
    const focusFrame = window.requestAnimationFrame(() => {
      editorRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.requestAnimationFrame(() => editButton?.focus());
    };
  }, [isEditing]);

  const closeEditor = () => {
    setValidationError(null);
    setIsEditing(false);
  };

  const handleSave = () => {
    const parsedAmount = Number(amount);
    const trimmedDescription = description.trim();
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setValidationError({
        field: 'amount',
        message: 'Enter an amount greater than zero.',
      });
      return;
    }
    if (isTransaction && !trimmedDescription) {
      setValidationError({
        field: 'description',
        message: 'Enter a description.',
      });
      return;
    }
    if (isTransaction && trimmedDescription.length > 255) {
      setValidationError({
        field: 'description',
        message: 'Keep the description to 255 characters or fewer.',
      });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsedAmount !== originalAmount) updates.amount = parsedAmount;
    if (isTransaction && trimmedDescription !== (transaction.description || '')) {
      updates.description = trimmedDescription;
    }

    closeEditor();
    if (Object.keys(updates).length > 0) onEdit(updates);
  };

  const openEditor = () => {
    setAmount(String(originalAmount || ''));
    setDescription(isTransaction ? transaction.description || '' : '');
    setValidationError(null);
    setIsEditing(true);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeEditor();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      editorRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') || [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section
      aria-label="Review pending financial action"
      className="mx-3 mb-2 rounded-popover border border-ledger-border bg-surface-strong p-4 sm:mx-4"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Review before saving</p>

      {isTransaction ? (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-amount text-xl font-semibold tabular-nums text-ink">
              ₹{transaction.amount?.toLocaleString('en-IN')}
            </span>
            <span className="text-sm font-medium text-ink-secondary">{transaction.category || 'Uncategorized'}</span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">{transaction.description}</p>
        </div>
      ) : isBulkTransaction ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-ink">{bulk.items.length} items</span>
            <span className="font-amount font-semibold tabular-nums text-ink">
              ₹{bulkTotal.toLocaleString('en-IN')} total
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-ink-secondary">
            {bulk.items.slice(0, 5).map((item, index) => (
              <p key={`${item.description}-${index}`} className="flex justify-between gap-3">
                <span className="truncate">
                  {index + 1}. {item.description}
                </span>
                <span className="shrink-0 font-amount tabular-nums text-ink">
                  ₹{item.amount.toLocaleString('en-IN')}, {item.category || 'Uncategorized'}
                </span>
              </p>
            ))}
            {bulk.items.length > 5 && <p className="text-xs text-ink-muted">+{bulk.items.length - 5} more</p>}
          </div>
        </div>
      ) : (
        <div>
          <p className="font-semibold text-ink">{budget.category}</p>
          <p className="mt-1 font-amount text-sm tabular-nums text-ink-secondary">
            ₹{budget.amount?.toLocaleString('en-IN')} per {budget.period}
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-2 min-[360px]:grid-cols-3">
        <Button onClick={onConfirm} disabled={disabled} className="w-full px-3">
          <Check className="h-4 w-4" /> {isBulkTransaction ? 'Confirm all' : 'Confirm'}
        </Button>
        {!isBulkTransaction && (
          <div ref={editButtonRef}>
            <Button variant="secondary" onClick={openEditor} disabled={disabled} className="w-full px-3">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        )}
        <Button variant="ghost" onClick={onCancel} disabled={disabled} className="w-full px-3">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>

      {isEditing && (
        <div
          data-chat-editor
          className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay px-4"
          onKeyDown={handleEditorKeyDown}
        >
          <div
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-editor-title"
            className="w-full max-w-sm rounded-popover border border-ledger-border bg-ledger-surface p-4 shadow-[0_4px_8px_rgb(0_0_0_/_0.12)]"
          >
            <h3 id="chat-editor-title" className="mb-4 text-base font-semibold text-ink">
              Edit {isTransaction ? 'transaction' : 'budget'}
            </h3>
            <div className="space-y-4">
              <Field
                label="Amount"
                htmlFor="confirmation-amount"
                error={validationError?.field === 'amount' ? validationError.message : undefined}
              >
                <input
                  id="confirmation-amount"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setValidationError(null);
                  }}
                  inputMode="decimal"
                  type="number"
                  min="0.01"
                  step="0.01"
                  aria-describedby={validationError?.field === 'amount' ? 'confirmation-amount-message' : undefined}
                  aria-invalid={validationError?.field === 'amount'}
                  className="min-h-11 w-full rounded-control border border-border-strong bg-surface-strong px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </Field>
              {isTransaction && (
                <Field
                  label="Description"
                  htmlFor="confirmation-description"
                  error={validationError?.field === 'description' ? validationError.message : undefined}
                >
                  <input
                    id="confirmation-description"
                    value={description}
                    maxLength={255}
                    aria-describedby={
                      validationError?.field === 'description' ? 'confirmation-description-message' : undefined
                    }
                    aria-invalid={validationError?.field === 'description'}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setValidationError(null);
                    }}
                    className="min-h-11 w-full rounded-control border border-border-strong bg-surface-strong px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </Field>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={disabled}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
