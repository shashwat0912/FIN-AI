import React, { useState, useEffect } from 'react';
import { Bell, Search, User, Settings, Menu, X, DollarSign, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useDarkMode } from '../../context/DarkModeContext';
import { apiClient } from '../../lib/api';
import DarkModeToggle from '../common/DarkModeToggle';
import { logger } from '../../utils/logger';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { currentLanguage, setLanguage, languages } = useLanguage();
  const { isDarkMode } = useDarkMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const navigate = useNavigate();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Enhanced search results data with more realistic financial data
  const mockSearchResults = [
    { type: 'transaction', title: 'Grocery Shopping', amount: '₹2,500', date: 'Today', icon: DollarSign, color: 'text-green-600' },
    { type: 'transaction', title: 'Uber Ride', amount: '₹180', date: 'Yesterday', icon: DollarSign, color: 'text-blue-600' },
    { type: 'transaction', title: 'Coffee Shop', amount: '₹320', date: '2 days ago', icon: DollarSign, color: 'text-orange-600' },
    { type: 'transaction', title: 'Amazon Purchase', amount: '₹1,200', date: '3 days ago', icon: DollarSign, color: 'text-purple-600' },
    { type: 'transaction', title: 'Restaurant Bill', amount: '₹850', date: '4 days ago', icon: DollarSign, color: 'text-red-600' },
    { type: 'goal', title: 'Emergency Fund', progress: '75%', target: '₹5,00,000', icon: Target, color: 'text-blue-600' },
    { type: 'goal', title: 'Vacation Fund', progress: '45%', target: '₹2,00,000', icon: Target, color: 'text-purple-600' },
    { type: 'goal', title: 'Home Down Payment', progress: '30%', target: '₹10,00,000', icon: Target, color: 'text-green-600' },
    { type: 'trend', title: 'Monthly Spending', change: '+12%', period: 'vs last month', icon: TrendingUp, color: 'text-purple-600' },
    { type: 'trend', title: 'Investment Growth', change: '+8.5%', period: 'YTD', icon: TrendingDown, color: 'text-orange-600' },
    { type: 'trend', title: 'Savings Rate', change: '+5.2%', period: 'this month', icon: TrendingUp, color: 'text-green-600' },
    { type: 'trend', title: 'Credit Score', change: '+15 points', period: 'last month', icon: TrendingUp, color: 'text-blue-600' }
  ];


  // Keyboard shortcut for search (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-menu') && !target.closest('.language-menu')) {
        setShowUserMenu(false);
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Enhanced search functionality with real API and debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedResultIndex(-1); // Reset selection when query changes
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length > 0) {
      // Debounce API calls by 300ms
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          // Search real transactions from API
          const apiResults = await apiClient.searchTransactions(query, 6);
          
          // Combine with some static results for goals and trends
          const staticResults = [
            { type: 'goal', title: 'Emergency Fund', progress: '75%', target: '₹5,00,000', icon: Target, color: 'text-blue-600' },
            { type: 'goal', title: 'Vacation Fund', progress: '45%', target: '₹2,00,000', icon: Target, color: 'text-purple-600' },
            { type: 'trend', title: 'Monthly Spending', change: '+12%', period: 'vs last month', icon: TrendingUp, color: 'text-purple-600' },
            { type: 'trend', title: 'Investment Growth', change: '+8.5%', period: 'YTD', icon: TrendingDown, color: 'text-orange-600' }
          ].filter(result => 
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            result.type.toLowerCase().includes(query.toLowerCase())
          );
          
          const allResults = [...apiResults, ...staticResults].slice(0, 6);
          setSearchResults(allResults);
          setShowSearchResults(true);
        } catch (error) {
          logger.error('TopBar: Search error', error instanceof Error ? error : undefined);
          // Fallback to static results if API fails
          const filteredResults = mockSearchResults.filter(result => 
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            result.type.toLowerCase().includes(query.toLowerCase()) ||
            (result.amount && result.amount.includes(query)) ||
            (result.change && result.change.includes(query))
          ).slice(0, 6);
          setSearchResults(filteredResults);
          setShowSearchResults(true);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    if (searchQuery.length > 0) {
      setShowSearchResults(true);
    }
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    setTimeout(() => setShowSearchResults(false), 200);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (selectedResultIndex >= 0 && searchResults[selectedResultIndex]) {
        // Navigate to selected result
        const result = searchResults[selectedResultIndex];
        if (result.type === 'transaction') {
          navigate('/transactions');
        } else if (result.type === 'goal') {
          navigate('/goals');
        } else if (result.type === 'trend') {
          navigate('/dashboard');
        }
        setShowSearchResults(false);
        setSearchQuery('');
        setSelectedResultIndex(-1);
      } else if (searchQuery.trim()) {
        // Navigate to transactions page with search query
        navigate(`/transactions?search=${encodeURIComponent(searchQuery.trim())}`);
        setShowSearchResults(false);
        setSearchQuery('');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSearchResults(false);
      setSelectedResultIndex(-1);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedResultIndex(-1);
  };


  // Language functionality
  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    setShowLanguageMenu(false);
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (confirmed) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu);
    setShowLanguageMenu(false); // Close language menu if open
  };

  return (
    <header className="h-16 bg-white dark:bg-dark-950 border-b border-gray-200 dark:border-dark-800 px-6 flex items-center justify-between shadow-sm relative transition-colors duration-500">
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-dark-800 rounded-lg transition-all duration-300"
          title="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 hidden md:block transition-colors duration-300">FinanceAI</span>
        </div>
      </div>

      {/* Center Section - Search Bar */}
      <div className="flex-1 flex justify-center px-8 max-w-2xl mx-auto">
        <div className="relative group w-full">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
              isSearchFocused ? 'text-purple-500' : 'text-gray-400'
            }`} />
            
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search transactions, goals, analytics, reports..."
              className={`w-full pl-10 pr-12 py-2.5 bg-gray-50 dark:bg-dark-800 border-2 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 
                focus:outline-none focus:ring-0 transition-all duration-500
                ${isSearchFocused 
                  ? 'bg-white dark:bg-dark-700 border-purple-500 shadow-lg shadow-purple-500/20' 
                  : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 hover:bg-white dark:hover:bg-dark-700'
                }`}
            />
            
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all duration-200"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 shadow-xl z-50 overflow-hidden animate-slide-up">
              <div className="p-3 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">Quick Results</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">{searchResults.length} items</span>
                </div>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {searchResults.length > 0 ? searchResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center p-3 transition-colors duration-150 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      selectedResultIndex === index 
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => {
                      // Navigate based on result type
                      if (result.type === 'transaction') {
                        navigate('/transactions');
                      } else if (result.type === 'goal') {
                        navigate('/goals');
                      } else if (result.type === 'trend') {
                        navigate('/dashboard');
                      }
                      setShowSearchResults(false);
                      setSearchQuery('');
                      setSelectedResultIndex(-1);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-600 flex items-center justify-center mr-3`}>
                      {result.icon === 'DollarSign' ? (
                        <DollarSign className={`w-4 h-4 ${result.color}`} />
                      ) : result.icon === 'Target' ? (
                        <Target className={`w-4 h-4 ${result.color}`} />
                      ) : result.icon === 'TrendingUp' ? (
                        <TrendingUp className={`w-4 h-4 ${result.color}`} />
                      ) : result.icon === 'TrendingDown' ? (
                        <TrendingDown className={`w-4 h-4 ${result.color}`} />
                      ) : (
                        <DollarSign className={`w-4 h-4 ${result.color}`} />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{result.title}</p>
                        {result.amount && (
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{result.amount}</span>
                        )}
                        {result.change && (
                          <span className={`text-sm font-medium ${result.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {result.change}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {result.type === 'transaction' ? (result.category || result.transactionType || 'transaction') : result.type}
                        </span>
                        {result.date && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{result.date}</span>
                        )}
                        {result.period && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{result.period}</span>
                        )}
                        {result.progress && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{result.progress} of {result.target}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-600">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Press Enter to search all</span>
                  <div className="flex items-center space-x-2">
                    <span>⌘K Focus</span>
                    <span>•</span>
                    <span>↑↓ Navigate</span>
                    <span>•</span>
                    <span>Esc Close</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4 relative">
        {/* Dark Mode Toggle */}
        <DarkModeToggle size="md" />

        {/* Language Selector */}
        <div className="relative language-menu">
          <button
            onClick={() => {
              setShowLanguageMenu(!showLanguageMenu);
            }}
            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all duration-200 group flex items-center space-x-1"
            title="Select Language"
          >
            <span className="text-sm font-medium">{currentLanguage.toUpperCase()}</span>
          </button>
          {showLanguageMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 py-1 border border-gray-200 dark:border-gray-700">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {lang.flag} {lang.nativeName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 group"
          title="Open settings"
        >
          <Settings className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* User Profile */}
        <div className="relative user-menu">
          <button
            onClick={handleUserMenuToggle}
            className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 group"
            title="User Profile"
          >
            <div className="h-8 w-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm group-hover:scale-110 transition-transform duration-200">
              S
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Shashwat</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Premium User</p>
            </div>
            <User className="h-4 w-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-200" />
          </button>
          
          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 py-1 border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Shashwat</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">testuser@example.com</p>
              </div>
              
              <button
                onClick={() => {
                  navigate('/settings');
                  setShowUserMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <Settings className="inline w-4 h-4 mr-2" />
                Settings
              </button>
              
              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <User className="inline w-4 h-4 mr-2" />
                Profile
              </button>
              
              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
              
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
              >
                <span className="inline w-4 h-4 mr-2">🚪</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}