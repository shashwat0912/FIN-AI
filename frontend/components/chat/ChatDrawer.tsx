import { X } from 'lucide-react';
import { useChatStore } from '../../hooks/useChatStore';
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
    isFallbackMode,
    toast,
    closeChat,
    sendMessage,
    confirm,
    edit,
    clearToast,
    retryLastAction,
  } = useChatStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={closeChat}
      />

      {/* Drawer panel */}
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 pointer-events-auto animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">FinanceAI</h2>
            {isFallbackMode && (
              <p className="text-[10px] text-zinc-500">Limited local responses</p>
            )}
          </div>
          <button
            onClick={closeChat}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <MessageList messages={messages} />

        {/* Toast-level errors */}
        {toast && (
          <ChatToast
            toast={toast}
            onDismiss={clearToast}
            onRetry={toast.retryable ? retryLastAction : undefined}
            disabled={isLoading}
          />
        )}

        {/* Rate limit banner */}
        {isRateLimited && <RateLimitBanner />}

        {/* Pending confirmation card */}
        {pendingConfirmation && pendingConfirmation.status === 'PENDING' && (
          <ConfirmationCard
            card={pendingConfirmation}
            onConfirm={() => confirm(pendingConfirmation.id)}
            onEdit={(data) => edit(pendingConfirmation.id, data)}
            onCancel={() => sendMessage('Cancel')}
            disabled={isLoading}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-500">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            Thinking...
          </div>
        )}

        {/* Input */}
        <ChatInputBar
          onSend={sendMessage}
          disabled={isLoading}
          isRateLimited={isRateLimited}
        />
      </div>
    </div>
  );
}
