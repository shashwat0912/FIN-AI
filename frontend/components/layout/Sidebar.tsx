import React from 'react';
import { NavLink } from 'react-router-dom';
import { BrainCircuit, X, LayoutDashboard, WalletCards, PieChart, Settings, Goal, Layers } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { colors, components, animations } from '../../styles/tokens';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useLanguage();
  
  const navItems = [
    { path: '/', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/transactions', label: t('transactions'), icon: WalletCards },
    { path: '/budget', label: t('budget'), icon: PieChart },
    { path: '/goals', label: t('goals'), icon: Goal },
    { path: '/ai-advisor', label: t('ai-advisor'), icon: BrainCircuit },
    { path: '/v1', label: t('finance-v1'), icon: Layers },
    { path: '/settings', label: t('settings'), icon: Settings }
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full ${colors.surface.base} border-r ${colors.border.default} shadow-lg z-50
        transform ${animations.transition.normal} ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64
      `}>
        {/* Header */}
        <div className={`h-16 flex items-center justify-between px-6 border-b ${colors.border.default}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 bg-gradient-to-r ${colors.gradient.primary} rounded-lg flex items-center justify-center`}>
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <span className={`text-lg font-semibold ${colors.text.primary}`}>FinanceAI</span>
          </div>
          
          {/* Close Button - Always visible */}
          <button
            onClick={onClose}
            className={components.button.icon}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => 
                isActive ? components.nav.active : `${components.nav.base} ${components.nav.hover}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${animations.transition.fast} ${
                    isActive ? 'text-purple-600 dark:text-purple-400' : `${colors.icon.gray} group-hover:text-gray-700 dark:group-hover:text-gray-200`
                  }`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t ${colors.border.default}`}>
          <div className={`flex items-center space-x-3 p-3 ${colors.surface.elevated} rounded-lg`}>
            <div className={`w-8 h-8 bg-gradient-to-r ${colors.gradient.primary} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
              S
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${colors.text.primary} truncate`}>Shashwat</p>
              <p className={`text-xs ${colors.text.secondary}`}>Premium User</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}