import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useChatStore } from '../../hooks/useChatStore';
import { IconButton } from '../ui/PrivateLedger';
import MessageList from './MessageList';
import ChatInputBar from './ChatInputBar';
import ConfirmationCard from './ConfirmationCard';
import RateLimitBanner from './RateLimitBanner';
import ChatToast from './ChatToast';

export default function ChatDrawer() {
  const {
    messages,
    isLoading,
    isOpen,
    pendingConfirmation,
    isRateLimited,
    toast,
    closeChat,
    sendMessage,
    confirm,
    edit,
    cancel,
    clearToast,
    retryLastAction,
  } = useChatStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLTextAreaElement>('[data-chat-input]')?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.querySelector('[data-chat-editor]')) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeChat();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeChat, isOpen]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-end ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-overlay transition-opacity duration-150 ease-out motion-reduce:transition-none ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeChat}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-chat-title"
        aria-busy={isLoading}
        className={`relative flex h-[100dvh] w-full flex-col border-l border-ledger-border bg-ledger-surface shadow-[-4px_0_8px_rgb(0_0_0_/_0.08)] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:max-w-[28rem] ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        <header className="flex min-h-16 items-center justify-between border-b border-ledger-border px-4">
          <h2 id="finance-chat-title" className="text-base font-semibold tracking-[-0.01em] text-ink">
            Finance Chat
          </h2>
          <IconButton onClick={closeChat} aria-label="Close Finance Chat">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </IconButton>
        </header>

        <MessageList messages={messages} />

        {toast && (
          <ChatToast
            toast={toast}
            onDismiss={clearToast}
            onRetry={toast.retryable ? retryLastAction : undefined}
            disabled={isLoading}
          />
        )}

        {isRateLimited && <RateLimitBanner />}

        {pendingConfirmation?.status === 'PENDING' && (
          <ConfirmationCard
            card={pendingConfirmation}
            onConfirm={() => confirm(pendingConfirmation.id)}
            onEdit={(data) => edit(pendingConfirmation.id, data)}
            onCancel={cancel}
            disabled={isLoading}
          />
        )}

        {isLoading && (
          <div role="status" aria-live="polite" className="px-4 py-2 text-xs text-ink-muted">
            Preparing a response…
          </div>
        )}

        <ChatInputBar onSend={sendMessage} disabled={isLoading} isRateLimited={isRateLimited} />
      </div>
    </div>
  );
}
