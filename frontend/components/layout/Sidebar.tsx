import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { onProfileUpdated } from '../../lib/appEvents';
import { readProfileIdentity } from '../../lib/profileIdentity';
import { useNavItems } from '../navigation/NavItems';
import { IconButton } from '../ui/PrivateLedger';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [identity, setIdentity] = useState(readProfileIdentity);
  const navItems = useNavItems();

  useEffect(() => onProfileUpdated(() => setIdentity(readProfileIdentity())), []);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="primary-navigation"
        aria-label="Primary navigation"
        className={`fixed left-0 top-0 z-50 h-full w-[216px] shrink-0 border-r border-ledger-border bg-ledger-surface text-ink transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:static lg:z-auto lg:visible lg:translate-x-0 ${
          isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-ledger-border px-4">
          <NavLink to="/dashboard" onClick={onClose} className="text-base font-semibold tracking-[-0.02em] text-ink">
            FinanceAI
          </NavLink>

          <IconButton
            onClick={onClose}
            className="lg:hidden"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ledger-surface motion-reduce:transition-none ${
                  isActive
                    ? 'bg-accent-soft font-semibold text-accent after:absolute after:left-0 after:h-5 after:w-px after:bg-accent after:content-[\'\']'
                    : 'font-medium text-ink-secondary hover:bg-surface-strong hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-accent' : 'text-ink-muted group-hover:text-ink-secondary'}`} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-ledger-border bg-ledger-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ledger-border bg-surface-strong text-xs font-semibold text-ink">
              {identity.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{identity.name}</p>
              {identity.contact && <p className="truncate text-xs text-ink-muted">{identity.contact}</p>}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
