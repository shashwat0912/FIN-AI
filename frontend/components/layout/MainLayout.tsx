import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { ThemeFade, ThemeSlide } from '../common/ThemeTransition';
import ChatFAB from '../chat/ChatFAB';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar with staggered animation */}
      <ThemeSlide stagger={1}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </ThemeSlide>
      
      {/* Main content area with staggered animation */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with staggered animation */}
        <ThemeSlide stagger={2}>
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
        </ThemeSlide>
        
        {/* Page content with staggered animation */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-dark-950 theme-transition-smooth">
          <ThemeFade stagger={3}>
            <div className="container mx-auto px-4 py-6">
              {children || <Outlet />}
            </div>
          </ThemeFade>
        </main>
      </div>

      {/* Chat FAB + Drawer overlay */}
      <ChatFAB />
    </div>
  );
}