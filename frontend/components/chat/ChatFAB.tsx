import { MessageCircle } from 'lucide-react';
import { useChatStore } from '../../hooks/useChatStore';
import ChatDrawer from './ChatDrawer';

export default function ChatFAB() {
  const { isOpen, toggleChat } = useChatStore();

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500 text-zinc-950 shadow-lg shadow-black/30 hover:bg-emerald-400 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Drawer */}
      <ChatDrawer />
    </>
  );
}
