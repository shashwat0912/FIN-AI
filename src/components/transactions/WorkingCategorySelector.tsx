import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';
import { Category, getCategoriesByType } from '../../data/categories';

// Icon mapping from icon names to emojis
const iconMap: Record<string, string> = {
  'Briefcase': '💼',
  'Building2': '🏢', 
  'Laptop': '💻',
  'TrendingUp': '📈',
  'Home': '🏠',
  'Percent': '💯',
  'DollarSign': '💰',
  'ArrowUpRight': '↗️',
  'Utensils': '🍽️',
  'ShoppingCart': '🛒',
  'Car': '🚗',
  'Fuel': '⛽',
  'Smartphone': '📱',
  'Zap': '⚡',
  'CreditCard': '💳',
  'Shield': '🛡️',
  'Users': '👥',
  'Heart': '❤️',
  'BookOpen': '📚',
  'HandHeart': '🤝',
  'PiggyBank': '🐷',
  'Gem': '💎',
  'Building': '🏗️',
  'Film': '🎬',
  'ShoppingBag': '🛍️',
  'Plane': '✈️',
  'Gift': '🎁',
  'Sparkles': '✨',
  'Landmark': '🏛️',
  'Banknote': '💵',
  'HomeIcon': '🏡',
  'HeartPulse': '🩺',
  'GraduationCap': '🎓',
  'Church': '⛪',
  'LineChart': '📈',
  'Shirt': '👕',
  'Cake': '🎂',
  'PlusCircle': '➕',
  'Scissors': '✂️',
  'Droplets': '💧',
  'Palette': '🎨',
  'Dumbbell': '🏋️'
};

// Helper function to get emoji from icon name
const getEmojiIcon = (iconName: string): string => {
  return iconMap[iconName] || '📋';
};

interface WorkingCategorySelectorProps {
  selectedCategory: Category | null;
  onCategorySelect: (category: Category | null) => void;
  transactionType: 'income' | 'expense';
  className?: string;
}

// Use real categories from data file

const WorkingCategorySelector: React.FC<WorkingCategorySelectorProps> = ({
  selectedCategory,
  onCategorySelect,
  transactionType,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter categories based on type and search
  const filteredCategories = getCategoriesByType(transactionType).filter(category => {
    const matchesSearch = searchQuery === '' || 
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Group categories
  const groupedCategories = filteredCategories.reduce((groups, category) => {
    const group = category.group;
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(category);
    return groups;
  }, {} as Record<string, Category[]>);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setShowCustomInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (category: Category) => {
    onCategorySelect(category);
    setIsOpen(false);
    setSearchQuery('');
    setShowCustomInput(false);
  };

  const handleCustomCategory = () => {
    if (customCategory.trim()) {
      const newCategory: Category = {
        id: `custom-${Date.now()}`,
        name: customCategory.trim(),
        type: transactionType,
        icon: 'PlusCircle',
        group: 'Custom',
        color: 'gray',
        description: 'Custom category'
      };
      handleCategorySelect(newCategory);
      setCustomCategory('');
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Category Display */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-purple-300 dark:hover:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 flex items-center justify-between group"
      >
        <div className="flex items-center space-x-3">
          {selectedCategory ? (
            <>
              <span className="text-lg">{getEmojiIcon(selectedCategory.icon)}</span>
              <span className="font-medium">{selectedCategory.name}</span>
              {selectedCategory.description && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedCategory.description}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              Select a category
            </span>
          )}
        </div>
        
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groupedCategories).map(([groupName, categories]) => (
              <div key={groupName} className="p-2">
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {groupName}
                </div>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category)}
                    className="w-full text-left px-3 py-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-3"
                  >
                    <span className="text-lg">{getEmojiIcon(category.icon)}</span>
                    <div className="flex-1">
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {category.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}

            {/* Custom Category Option */}
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full text-left px-3 py-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-200 flex items-center space-x-3"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Category</span>
              </button>
            ) : (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomCategory()}
                    autoFocus
                  />
                  <button
                    onClick={handleCustomCategory}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkingCategorySelector;
