import { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
        <div className="text-center">
          <p className="mb-1 text-base font-medium text-zinc-300">Start a conversation</p>
          <p>Try "Spent 400 on food" or "How much did I spend this month?"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1 p-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
