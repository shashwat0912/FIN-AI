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
        className="flex h-11 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-left text-sm text-zinc-100 hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
      >
        <div className="flex min-w-0 items-center gap-2">
          {selectedCategory ? (
            <>
              <span className="hidden">{getEmojiIcon(selectedCategory.icon)}</span>
              <span className="truncate font-medium">{selectedCategory.name}</span>
              {selectedCategory.description && (
                <span className="hidden truncate text-zinc-500 sm:inline">
                  {selectedCategory.description}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-500">
              Select a category
            </span>
          )}
        </div>
        
        <ChevronDown 
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 max-h-96 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          {/* Search Bar */}
          <div className="border-b border-zinc-800 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
              />
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groupedCategories).map(([groupName, categories]) => (
              <div key={groupName} className="p-2">
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {groupName}
                </div>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-900"
                  >
                    <span className="hidden">{getEmojiIcon(category.icon)}</span>
                    <div className="flex-1">
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-zinc-500">
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
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium text-emerald-300 hover:bg-emerald-500/10"
              >
                <Plus className="h-4 w-4" />
                <span>Add Custom Category</span>
              </button>
            ) : (
              <div className="border-t border-zinc-800 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category..."
                    className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomCategory()}
                    autoFocus
                  />
                  <button
                    onClick={handleCustomCategory}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
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
