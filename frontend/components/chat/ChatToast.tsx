import { AlertCircle, AlertTriangle, RefreshCw, Shield, WifiOff, X } from 'lucide-react';
import { ChatToast as ChatToastType } from '../../types';

interface ChatToastProps {
  toast: ChatToastType;
  onDismiss: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}

const TOAST_STYLES: Record<ChatToastType['kind'], { container: string; icon: JSX.Element }> = {
  network: {
    container: 'border-warning bg-ledger-surface text-ink',
    icon: <WifiOff className="h-4 w-4 text-warning" />,
  },
  auth: {
    container: 'border-accent bg-ledger-surface text-ink',
    icon: <Shield className="h-4 w-4 text-accent" />,
  },
  validation: {
    container: 'border-negative bg-ledger-surface text-ink',
    icon: <AlertTriangle className="h-4 w-4 text-negative" />,
  },
  generic: {
    container: 'border-border-strong bg-ledger-surface text-ink',
    icon: <AlertCircle className="h-4 w-4 text-ink-muted" />,
  },
};

export default function ChatToast({ toast, onDismiss, onRetry, disabled }: ChatToastProps) {
  const style = TOAST_STYLES[toast.kind];

  return (
    <div role="alert" className={`mx-4 mb-2 rounded-popover border px-4 py-3 ${style.container}`}>
      <div className="flex items-start gap-3">
        <div className="mt-1">{style.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-xs leading-5 text-ink-secondary">{toast.message}</p>
          {toast.retryable && onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                disabled={disabled}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-border-strong px-3 text-xs font-semibold text-ink transition-[background-color,border-color,color,transform] duration-150 ease-out hover:bg-accent-soft active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {toast.actionLabel || 'Retry'}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent-soft hover:text-ink active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
          aria-label="Dismiss chat notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
