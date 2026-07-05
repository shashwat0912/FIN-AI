import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';

interface ChatInputBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isRateLimited?: boolean;
}

export default function ChatInputBar({ onSend, disabled, isRateLimited }: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-zinc-800 bg-zinc-950 p-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isRateLimited ? 'Please wait...' : 'Type a message...'}
        disabled={disabled || isRateLimited}
        rows={1}
        className="min-h-11 flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
        style={{ maxHeight: '100px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || isRateLimited || !value.trim()}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
