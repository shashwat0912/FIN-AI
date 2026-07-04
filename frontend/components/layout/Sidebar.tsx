import React from 'react';
import { NavLink } from 'react-router-dom';
import { BrainCircuit, Goal, Layers, LayoutDashboard, PieChart, Settings, WalletCards, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useLanguage();

  const navItems = [
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/dashboard/transactions', label: t('transactions'), icon: WalletCards },
    { path: '/dashboard/budget', label: t('budget'), icon: PieChart },
    { path: '/dashboard/goals', label: t('goals'), icon: Goal },
    { path: '/dashboard/ai-advisor', label: t('ai-advisor'), icon: BrainCircuit },
    { path: '/dashboard/v1', label: t('finance-v1'), icon: Layers },
    { path: '/dashboard/settings', label: t('settings'), icon: Settings },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 xl:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 shrink-0 transform border-r border-zinc-800 bg-zinc-950 text-white transition-transform duration-300 ease-out xl:static xl:z-auto xl:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold text-zinc-100">FinanceAI</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 xl:hidden"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-emerald-300' : 'text-zinc-500 group-hover:text-zinc-200'}`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-100">
              SS
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100">Shashwat</p>
              <p className="truncate text-xs text-zinc-500">testuser@example.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
