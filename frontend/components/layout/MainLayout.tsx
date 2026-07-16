import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChatFAB from '../chat/ChatFAB';
import { PageContainer } from '../ui/PrivateLedger';

interface MainLayoutProps {
  children?: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="private-ledger flex h-[100dvh] min-h-0 overflow-hidden bg-canvas text-ink">
      <a href="#main-content" className="fixed left-4 top-3 z-[70] -translate-y-20 rounded-control bg-accent px-3 py-2 text-sm font-semibold text-surface-strong focus:translate-y-0">
        Skip to content
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-auto bg-canvas outline-none">
          <PageContainer>
            {children || <Outlet />}
          </PageContainer>
        </main>
      </div>

      <ChatFAB />
    </div>
  );
}
