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
        className="absolute inset-0 bg-black/30 dark:bg-black/50 pointer-events-auto"
        onClick={closeChat}
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-md h-full flex flex-col bg-white dark:bg-dark-900 shadow-2xl pointer-events-auto animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Finance Chat</h2>
            {isFallbackMode && (
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400">Running in local mode (deterministic parser)</p>
            )}
          </div>
          <button
            onClick={closeChat}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
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
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
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
