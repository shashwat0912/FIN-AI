import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { onProfileUpdated } from '../../lib/appEvents';
import { readProfileIdentity } from '../../lib/profileIdentity';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [identity, setIdentity] = useState(readProfileIdentity);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => onProfileUpdated(() => setIdentity(readProfileIdentity())), []);

  const handleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (confirmed) {
      localStorage.clear();
      window.location.assign('/');
    }
  };

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 text-white sm:px-6">
      <div className="flex items-center gap-3 xl:hidden">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">
            F
          </div>
          <span className="hidden text-base font-semibold text-zinc-100 md:block">FinanceAI</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => navigate('/dashboard/settings')}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
          title="Open settings"
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowUserMenu((isOpen) => !isOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-semibold text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800"
            title="User profile"
            aria-label="User profile"
          >
            {identity.initials}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/30">
              <div className="border-b border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{identity.name}</p>
                {identity.contact && <p className="mt-0.5 text-xs text-zinc-500">{identity.contact}</p>}
              </div>

              <button
                onClick={() => {
                  navigate('/dashboard/settings');
                  setShowUserMenu(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                <User className="h-4 w-4" />
                Profile
              </button>

              <div className="border-t border-zinc-800" />

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
