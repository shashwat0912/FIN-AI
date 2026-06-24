import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { ConfirmationCard as ConfirmationCardType, ChatTransactionEntities, ChatBudgetEntities } from '../../types';

interface ConfirmationCardProps {
  card: ConfirmationCardType;
  onConfirm: () => void;
  onEdit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function ConfirmationCard({ card, onConfirm, onEdit, onCancel, disabled }: ConfirmationCardProps) {
  const isTransaction = card.type === 'transaction';
  const txn = card.data as ChatTransactionEntities;
  const budget = card.data as ChatBudgetEntities;
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
    <div className="mx-4 mb-2 rounded-xl border border-purple-200 dark:border-purple-800/40 bg-white dark:bg-dark-800 p-4 shadow-sm">
      {isTransaction ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{txn.type === 'income' ? '💰' : '💸'}</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              ₹{txn.amount?.toLocaleString('en-IN')}
            </span>
            <span className="text-gray-500 dark:text-gray-400">—</span>
            <span className="text-gray-700 dark:text-gray-300">{txn.category || 'Uncategorized'}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{txn.description}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📊</span>
            <span className="font-semibold text-gray-900 dark:text-white">{budget.category}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            ₹{budget.amount?.toLocaleString('en-IN')} per {budget.period}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Confirm
        </button>
        <button
          type="button"
          onClick={openEditor}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900/60 disabled:opacity-50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white dark:bg-dark-800 p-4 shadow-xl border border-gray-200 dark:border-dark-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Edit transaction</h3>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                Amount
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </label>
              {isTransaction && (
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Description
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </label>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={disabled}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
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
