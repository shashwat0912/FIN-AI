import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  theme: 'light' | 'dark';
  isTransitioning: boolean;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check if we're in the browser
    if (typeof window !== 'undefined') {
      try {
        // First check user's theme preference
        const userPreferences = localStorage.getItem('userPreferences');
        if (userPreferences) {
          const prefs = JSON.parse(userPreferences);
          if (prefs.theme === 'auto') {
            // For auto theme, use system preference
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
          } else if (prefs.theme === 'dark') {
            return true;
          } else if (prefs.theme === 'light') {
            return false;
          }
        }
        
        // Fallback to old darkMode localStorage
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode !== null && savedDarkMode !== undefined) {
          return savedDarkMode === 'true';
        }
        
        // Default to system preference if no saved preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch (error) {
        logger.warn('Error reading theme preferences from localStorage');
        return false;
      }
    }
    return false;
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  // Apply dark mode to document with premium smooth transitions
  useEffect(() => {
    // Start transition
    setIsTransitioning(true);
    
    // Add premium transition classes
    document.documentElement.classList.add('theme-transitioning');
    document.body.classList.add('theme-transitioning');
    
    // Apply theme with smooth transition
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0f0f23'; // Premium dark background
      document.body.style.color = '#e2e8f0';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff'; // Clean white background
      document.body.style.color = '#1f2937';
    }
    
    // End transition after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
      document.body.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, 200); // Fast and responsive
  }, [isDarkMode]);

  // Listen for system theme changes when auto is selected
  useEffect(() => {
    // Get current theme preference
    const userPreferences = localStorage.getItem('userPreferences');
    if (userPreferences) {
      try {
        const prefs = JSON.parse(userPreferences);
        setCurrentTheme(prefs.theme || 'auto');
      } catch (error) {
        logger.warn('Error parsing user preferences');
      }
    }
  }, []); // Only run once on mount

  // Separate effect to listen for system changes only when auto is selected
  useEffect(() => {
    // Only listen for system changes if theme is set to auto
    if (currentTheme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        // Double-check that theme is still auto before updating
        const currentPrefs = localStorage.getItem('userPreferences');
        if (currentPrefs) {
          try {
            const prefs = JSON.parse(currentPrefs);
            if (prefs.theme === 'auto') {
              const shouldBeDark = e.matches;
              if (shouldBeDark !== isDarkMode) {
                setIsDarkMode(shouldBeDark);
              }
            }
          } catch (error) {
            logger.warn('Error handling system theme change');
          }
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, [currentTheme, isDarkMode]);

  // Listen for theme changes from Settings page
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userPreferences' && e.newValue) {
        try {
          const prefs = JSON.parse(e.newValue);
          setCurrentTheme(prefs.theme || 'auto');
          
          // Apply the theme immediately
          if (prefs.theme === 'dark') {
            setIsDarkMode(true);
          } else if (prefs.theme === 'light') {
            setIsDarkMode(false);
          } else if (prefs.theme === 'auto') {
            // For auto, use system preference
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDarkMode(systemPrefersDark);
          }
        } catch (error) {
          logger.warn('Error handling theme change from storage');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    
    // Add a subtle haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    setIsDarkMode(newDarkMode);
    
    // Save to localStorage with error handling
    try {
      localStorage.setItem('darkMode', newDarkMode.toString());
    } catch (error) {
      logger.warn('Error saving darkMode to localStorage');
    }
  };

  const value: DarkModeContextType = {
    isDarkMode,
    toggleDarkMode,
    theme: isDarkMode ? 'dark' : 'light',
    isTransitioning,
  };

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
}

export const useDarkMode = (): DarkModeContextType => {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
