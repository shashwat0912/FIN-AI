import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onProfileUpdated } from '../../lib/appEvents';
import { readProfileIdentity } from '../../lib/profileIdentity';
import { useNavItems } from '../navigation/NavItems';
import { IconButton } from '../ui/PrivateLedger';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [identity, setIdentity] = useState(readProfileIdentity);
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = useNavItems();
  const menuRef = useRef<HTMLDivElement>(null);
  const currentSection = navItems.find((item) => item.path === location.pathname)?.label || navItems[0].label;

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
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-ledger-border bg-ledger-surface px-3 text-ink sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <IconButton
          onClick={onMenuClick}
          className="lg:hidden"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
          aria-controls="primary-navigation"
        >
          <Menu className="h-[18px] w-[18px]" />
        </IconButton>

        <p className="truncate text-sm font-semibold text-ink">{currentSection}</p>
      </div>

      <div className="ml-auto flex items-center">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowUserMenu((isOpen) => !isOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-ledger-border bg-surface-strong text-sm font-semibold text-ink transition-colors duration-150 ease-out hover:border-border-strong hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ledger-surface motion-reduce:transition-none"
            title="User profile"
            aria-label="User profile"
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
          >
            {identity.initials}
          </button>

          {showUserMenu && (
            <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-popover border border-border-strong bg-surface-strong">
              <div className="border-b border-ledger-border px-4 py-3">
                <p className="text-sm font-medium text-ink">{identity.name}</p>
                {identity.contact && <p className="mt-0.5 truncate text-xs text-ink-muted">{identity.contact}</p>}
              </div>

              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-ink-secondary transition-colors duration-150 hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:bg-accent-soft focus-visible:text-ink"
              >
                <User className="h-4 w-4" />
                Profile
              </button>

              <div className="border-t border-ledger-border" />

              <button
                onClick={handleLogout}
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-negative transition-colors duration-150 hover:bg-ledger-surface focus:outline-none focus-visible:bg-ledger-surface"
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
