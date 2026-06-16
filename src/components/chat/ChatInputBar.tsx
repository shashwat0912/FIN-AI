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
    <div className="flex items-end gap-2 p-3 border-t border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isRateLimited ? 'Please wait...' : 'Type a message...'}
        disabled={disabled || isRateLimited}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none disabled:opacity-50 transition-all"
        style={{ maxHeight: '100px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || isRateLimited || !value.trim()}
        className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
