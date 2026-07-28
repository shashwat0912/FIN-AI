import { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    shouldStickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-ink-muted">
        <div className="text-center">
          <p className="mb-1 text-base font-medium text-ink">Start a conversation</p>
          <p>Try “Spent 400 on food” or “How much did I spend this month?”</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="log"
      aria-label="Finance Chat messages"
      aria-live="polite"
      aria-relevant="additions"
      onScroll={handleScroll}
      className="flex-1 space-y-1 overflow-y-auto p-4"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
