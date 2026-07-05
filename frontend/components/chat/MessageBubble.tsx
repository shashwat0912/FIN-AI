import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'USER';

  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-md border border-zinc-700 bg-zinc-800 text-zinc-100'
            : 'rounded-bl-md border border-zinc-800 bg-zinc-900/80 text-zinc-200'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="mt-1 text-[10px] text-zinc-500">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
