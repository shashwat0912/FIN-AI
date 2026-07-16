import { MessageCircle } from 'lucide-react';
import { useChatStore } from '../../hooks/useChatStore';
import ChatDrawer from './ChatDrawer';

export default function ChatFAB() {
  const { isOpen, toggleChat } = useChatStore();

  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-ledger-surface text-accent transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-accent hover:bg-accent-soft hover:text-ink active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none sm:bottom-6 sm:right-6"
          aria-label="Open chat"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}

      <ChatDrawer />
    </>
  );
}
