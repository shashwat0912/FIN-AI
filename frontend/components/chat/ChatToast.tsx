import { AlertCircle, RefreshCw, WifiOff, Shield, AlertTriangle, X } from 'lucide-react';
import { ChatToast as ChatToastType } from '../../types';

interface ChatToastProps {
  toast: ChatToastType;
  onDismiss: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}

const TOAST_STYLES: Record<ChatToastType['kind'], { container: string; icon: JSX.Element }> = {
  network: {
    container: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    icon: <WifiOff className="h-4 w-4 text-amber-300" />,
  },
  auth: {
    container: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
    icon: <Shield className="h-4 w-4 text-blue-300" />,
  },
  validation: {
    container: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
    icon: <AlertTriangle className="h-4 w-4 text-rose-300" />,
  },
  generic: {
    container: 'border-white/15 bg-white/5 text-white',
    icon: <AlertCircle className="h-4 w-4 text-white/70" />,
  },
};

export default function ChatToast({ toast, onDismiss, onRetry, disabled }: ChatToastProps) {
  const style = TOAST_STYLES[toast.kind];

  return (
    <div
      role="alert"
      className={`mx-4 mb-2 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm ${style.container}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{style.icon}</div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-current/85">{toast.message}</p>

          <div className="mt-3 flex items-center gap-2">
            {toast.retryable && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-full border border-current/30 px-3 py-1 text-[11px] font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-3 w-3" />
                {toast.actionLabel || 'Retry'}
              </button>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] underline decoration-current/50 underline-offset-2 transition hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-current/70 transition hover:bg-white/10 hover:text-current"
          aria-label="Dismiss chat toast"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
