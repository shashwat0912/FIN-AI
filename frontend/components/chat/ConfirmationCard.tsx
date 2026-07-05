import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { ConfirmationCard as ConfirmationCardType, ChatTransactionEntities, ChatBudgetEntities, ChatBulkTransactionEntities } from '../../types';

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
  const txn = card.data as ChatTransactionEntities;
  const budget = card.data as ChatBudgetEntities;
  const bulk = card.data as ChatBulkTransactionEntities;
  const bulkTotal = isBulkTransaction ? bulk.items.reduce((sum, item) => sum + item.amount, 0) : 0;
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(String((isTransaction ? txn.amount : budget.amount) || ''));
  const [description, setDescription] = useState(isTransaction ? txn.description || '' : '');

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    const parsedAmount = Number(amount);
    const originalAmount = isTransaction ? txn.amount : budget.amount;

    if (Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount !== originalAmount) {
      updates.amount = parsedAmount;
    }
    if (isTransaction && description.trim() !== (txn.description || '')) {
      updates.description = description.trim();
    }

    onEdit(updates);
    setIsEditing(false);
  };

  const openEditor = () => {
    setAmount(String((isTransaction ? txn.amount : budget.amount) || ''));
    setDescription(isTransaction ? txn.description || '' : '');
    setIsEditing(true);
  };

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm sm:mx-4">
      {isTransaction ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-lg">{txn.type === 'income' ? '💰' : '💸'}</span>
            <span className="font-semibold text-white">
              ₹{txn.amount?.toLocaleString('en-IN')}
            </span>
            <span className="text-zinc-600">-</span>
            <span className="text-zinc-300">{txn.category || 'Uncategorized'}</span>
          </div>
          <p className="mb-3 text-sm text-zinc-500">{txn.description}</p>
        </div>
      ) : isBulkTransaction ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{bulk.items.length} items</span>
            <span className="text-zinc-600">-</span>
            <span className="text-zinc-300">₹{bulkTotal.toLocaleString('en-IN')} total</span>
          </div>
          <div className="mb-3 space-y-1 text-sm text-zinc-400">
            {bulk.items.slice(0, 5).map((item, index) => (
              <p key={`${item.description}-${index}`} className="flex justify-between gap-3">
                <span className="truncate">{index + 1}. {item.description}</span>
                <span className="shrink-0 text-zinc-300">
                  ₹{item.amount.toLocaleString('en-IN')} · {item.category || 'Uncategorized'}
                </span>
              </p>
            ))}
            {bulk.items.length > 5 && (
              <p className="text-xs text-zinc-500">+{bulk.items.length - 5} more</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className="font-semibold text-white">{budget.category}</span>
          </div>
          <p className="mb-3 text-sm text-zinc-500">
            ₹{budget.amount?.toLocaleString('en-IN')} per {budget.period}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:flex-wrap">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" /> {isBulkTransaction ? 'Confirm all' : 'Confirm'}
        </button>
        {!isBulkTransaction && (
          <button
            type="button"
            onClick={openEditor}
            disabled={disabled}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-transparent px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/40">
            <h3 className="mb-3 text-sm font-semibold text-white">Edit transaction</h3>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-zinc-300">
                Amount
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>
              {isTransaction && (
                <label className="block text-xs font-medium text-zinc-300">
                  Description
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={disabled}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
