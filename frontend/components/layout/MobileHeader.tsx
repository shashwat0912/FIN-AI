import React from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from '../../hooks/useSidebar';

export default function MobileHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
      onClick={toggleSidebar}
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}