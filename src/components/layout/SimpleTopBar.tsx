import React, { useState } from 'react';
import { Search, User, Settings, X, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import DarkModeToggle from '../common/DarkModeToggle';
import { logger } from '../../utils/logger';

interface SimpleTopBarProps {
  onMenuClick: () => void;
}

export default function SimpleTopBar({ onMenuClick }: SimpleTopBarProps) {
  const { isDarkMode } = useDarkMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('EN');
  const navigate = useNavigate();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSearchResults(query.length > 0);
  };

  const handleLanguageChange = (lang: string) => {
    logger.info('Changing language', { lang });
    setCurrentLanguage(lang);
    setShowLanguageMenu(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchQuery.trim()) {
        // Navigate to transactions page with search query
        navigate(`/transactions?search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchQuery('');
      }
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-between shadow-sm">
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-white hidden md:block">FinanceAI</span>
        </div>
      </div>

      {/* Center Section - Search Bar */}
      <div className="flex-1 flex justify-center px-8 max-w-2xl mx-auto">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search transactions, goals, analytics..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* Dark Mode Toggle */}
        <DarkModeToggle size="md" />

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg flex items-center space-x-1"
          >
            <span className="text-sm font-medium">{currentLanguage}</span>
          </button>
          {showLanguageMenu && (
            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 py-1 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleLanguageChange('EN')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                🇺🇸 English
              </button>
              <button
                onClick={() => handleLanguageChange('HI')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                🇮🇳 हिंदी
              </button>
              <button
                onClick={() => handleLanguageChange('MR')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                🇮🇳 मराठी
              </button>
              <button
                onClick={() => handleLanguageChange('KN')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                🇮🇳 ಕನ್ನಡ
              </button>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* User Profile */}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
        >
          <div className="h-8 w-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            S
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Shashwat</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Premium User</p>
          </div>
          <User className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </header>
  );
}

