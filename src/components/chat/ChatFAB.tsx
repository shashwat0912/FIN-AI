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
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all"
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
