/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { logger } from '../utils/logger';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

interface DarkModeContextType {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
  // Compatibility aliases for untouched authentication and settings surfaces.
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  theme: ResolvedTheme;
  isTransitioning: false;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);
const THEME_KEY = 'userPreferences';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'auto';

const getSystemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const readPreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'light';

  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      const preference = JSON.parse(stored).theme;
      if (isThemePreference(preference)) return preference;
    }

    const legacy = localStorage.getItem('darkMode');
    if (legacy !== null) {
      const preference = legacy === 'true' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, JSON.stringify({ theme: preference }));
      localStorage.removeItem('darkMode');
      return preference;
    }
  } catch {
    logger.warn('Error reading theme preferences from localStorage');
  }

  return 'light';
};

const applyTheme = (theme: ResolvedTheme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme: ResolvedTheme = preference === 'auto' ? systemTheme : preference;

  useLayoutEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);

  useEffect(() => {
    if (preference !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [preference]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== THEME_KEY || !event.newValue) return;

      try {
        const nextPreference = JSON.parse(event.newValue).theme;
        if (isThemePreference(nextPreference)) setPreference(nextPreference);
      } catch {
        logger.warn('Error synchronizing theme preferences across tabs');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setTheme = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);

    try {
      const stored = localStorage.getItem(THEME_KEY);
      const preferences = stored ? JSON.parse(stored) : {};
      localStorage.setItem(THEME_KEY, JSON.stringify({ ...preferences, theme: nextPreference }));
    } catch {
      logger.warn('Error saving theme preferences to localStorage');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo<DarkModeContextType>(() => ({
    preference,
    resolvedTheme,
    setTheme,
    isDarkMode: resolvedTheme === 'dark',
    toggleDarkMode,
    theme: resolvedTheme,
    isTransitioning: false,
  }), [preference, resolvedTheme, setTheme, toggleDarkMode]);

  return <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>;
}

export const useDarkMode = (): DarkModeContextType => {
  const context = useContext(DarkModeContext);
  if (!context) throw new Error('useDarkMode must be used within a DarkModeProvider');
  return context;
};
