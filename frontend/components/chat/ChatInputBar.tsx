import React, { useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputBarProps {
  onSend: (message: string) => Promise<void> | void;
  disabled?: boolean;
  isRateLimited?: boolean;
}

export default function ChatInputBar({ onSend, disabled, isRateLimited }: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isRateLimited || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      await onSend(trimmed);
    } finally {
      isSubmittingRef.current = false;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 112)}px`;
  };

  return (
    <div className="flex items-end gap-2 border-t border-ledger-border bg-ledger-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <span id="chat-input-help" className="sr-only">
        Press Enter to send. Press Shift and Enter for a new line.
      </span>
      <textarea
        ref={inputRef}
        data-chat-input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={isRateLimited ? 'Please wait...' : 'Type a message...'}
        disabled={disabled || isRateLimited}
        aria-label="Message Finance Chat"
        aria-describedby="chat-input-help"
        maxLength={2000}
        rows={1}
        className="min-h-11 max-h-28 flex-1 resize-none overflow-y-auto rounded-control border border-border-strong bg-surface-strong px-3 py-2.5 text-sm leading-6 text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={disabled || isRateLimited || !value.trim()}
        aria-label="Send message"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-control border border-accent bg-accent text-surface-strong transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-accent-hover hover:bg-accent-hover active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        <Send className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
