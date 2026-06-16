import { Check, X, Pencil } from 'lucide-react';
import { ConfirmationCard as ConfirmationCardType, ChatTransactionEntities, ChatBudgetEntities } from '../../types';

interface ConfirmationCardProps {
  card: ConfirmationCardType;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export default function ConfirmationCard({ card, onConfirm, onCancel, disabled }: ConfirmationCardProps) {
  const isTransaction = card.type === 'transaction';
  const txn = card.data as ChatTransactionEntities;
  const budget = card.data as ChatBudgetEntities;

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
          onClick={onConfirm}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Confirm
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600 disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
