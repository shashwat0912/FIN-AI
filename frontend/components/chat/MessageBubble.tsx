import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'USER';

  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`text-sm leading-6 ${
          isUser
            ? 'max-w-[85%] rounded-control bg-accent-soft px-3.5 py-2.5 text-ink'
            : 'w-full max-w-[65ch] py-1 text-ink-secondary'
        }`}
      >
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
        <time className="sr-only" dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  );
}
