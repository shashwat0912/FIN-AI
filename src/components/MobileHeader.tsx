import React from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from '../hooks/useSidebar';

export default function MobileHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between px-4 h-full">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            FinanceAI
          </span>
        </div>
      </div>
    </header>
  );
}