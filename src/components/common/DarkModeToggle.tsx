import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { colors, animations } from '../../styles/tokens';

interface DarkModeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function DarkModeToggle({ 
  className = '', 
  size = 'md' 
}: DarkModeToggleProps) {
  const { isDarkMode, toggleDarkMode, isTransitioning } = useDarkMode();

  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      onClick={toggleDarkMode}
      disabled={isTransitioning}
      className={`
        ${sizeClasses[size]}
        ${className}
        relative
        rounded-xl
        ${colors.surface.overlay}
        ${colors.surface.hover.replace('hover:', 'hover:bg-gray-200 dark:hover:')}
        border ${colors.border.default}
        shadow-sm hover:shadow-md
        theme-transition-smooth
        group
        overflow-hidden
        focus:outline-none focus:ring-2 focus:ring-purple-500/20
        active:scale-95
        ${isTransitioning ? 'animate-theme-pulse' : ''}
        ${isTransitioning ? 'pointer-events-none' : ''}
      `}
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {/* Premium background gradient with theme-aware colors */}
      <div className={`
        absolute inset-0 
        bg-gradient-to-br 
        ${isDarkMode 
          ? 'from-blue-500/10 to-purple-500/10' 
          : 'from-amber-500/10 to-orange-500/10'
        } 
        opacity-0 group-hover:opacity-100 
        transition-all duration-500 ease-out
      `} />
      
      {/* Animated background ring during transition */}
      {isTransitioning && (
        <div className="absolute inset-0 rounded-xl animate-theme-glow" />
      )}
      
      {/* Icon container with premium animations */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="relative">
          {/* Sun icon with enhanced animations */}
          <Sun 
            className={`
              ${iconSizes[size]}
              absolute inset-0
              text-amber-500 dark:text-amber-400
              transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
              ${isDarkMode 
                ? 'opacity-0 rotate-180 scale-0 translate-y-2' 
                : 'opacity-100 rotate-0 scale-100 translate-y-0'
              }
              ${isTransitioning && !isDarkMode ? 'animate-theme-rotate' : ''}
            `}
          />
          
          {/* Moon icon with enhanced animations */}
          <Moon 
            className={`
              ${iconSizes[size]}
              absolute inset-0
              text-slate-600 dark:text-slate-300
              transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
              ${isDarkMode 
                ? 'opacity-100 rotate-0 scale-100 translate-y-0' 
                : 'opacity-0 -rotate-180 scale-0 -translate-y-2'
              }
              ${isTransitioning && isDarkMode ? 'animate-theme-rotate' : ''}
            `}
          />
        </div>
      </div>
      
      {/* Premium glow effect with theme-aware colors */}
      <div className={`
        absolute inset-0 rounded-xl
        transition-all duration-500 ease-out
        ${isDarkMode 
          ? 'bg-blue-500/5 group-hover:bg-blue-500/15' 
          : 'bg-amber-500/5 group-hover:bg-amber-500/15'
        }
        opacity-0 group-hover:opacity-100
        ${isTransitioning ? 'opacity-100' : ''}
      `} />
      
      {/* Subtle border glow */}
      <div className={`
        absolute inset-0 rounded-xl
        border-2 border-transparent
        transition-all duration-500 ease-out
        ${isDarkMode 
          ? 'group-hover:border-blue-500/20' 
          : 'group-hover:border-amber-500/20'
        }
        ${isTransitioning ? 'border-purple-500/30' : ''}
      `} />
    </button>
  );
}

