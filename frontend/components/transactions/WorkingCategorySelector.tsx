import React, { useState, useEffect, useId, useRef } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';
import { Category, getCategoriesByType } from '../../data/categories';
import { ledgerControlClass } from '../../styles/tokens';

interface WorkingCategorySelectorProps {
  id?: string;
  selectedCategory: Category | null;
  onCategorySelect: (category: Category | null) => void;
  transactionType: 'income' | 'expense';
  className?: string;
}

// Use real categories from data file

const WorkingCategorySelector: React.FC<WorkingCategorySelectorProps> = ({
  id,
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
  const generatedId = useId();
  const controlId = id || `category-${generatedId}`;
  const menuId = `${controlId}-menu`;

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
    <div className={`relative ${className}`} ref={dropdownRef} onKeyDown={(event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
        setShowCustomInput(false);
      }
    }}>
      <button
        id={controlId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className={`${ledgerControlClass} flex items-center justify-between text-left`}
      >
        <div className="min-w-0">
          {selectedCategory ? (
            <span className="block truncate font-medium">{selectedCategory.name}</span>
          ) : (
            <span className="text-ink-muted">Select a category</span>
          )}
        </div>
        
        <ChevronDown 
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-150 motion-reduce:transition-none ${
            isOpen ? 'rotate-180' : ''
          }`} 
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 max-h-96 w-full min-w-64 overflow-hidden rounded-popover border border-border-strong bg-surface-strong">
          <div className="border-b border-ledger-border p-3">
            <label htmlFor={`${controlId}-search`} className="sr-only">Search categories</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id={`${controlId}-search`}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className={`${ledgerControlClass} h-10 pl-9`}
                autoFocus
              />
            </div>
          </div>

          <div id={menuId} role="listbox" aria-label="Categories" className="max-h-64 overflow-y-auto">
            {Object.entries(groupedCategories).map(([groupName, categories]) => (
              <div key={groupName} role="group" aria-label={groupName} className="p-2">
                <div className="px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                  {groupName}
                </div>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    role="option"
                    aria-selected={selectedCategory?.id === category.id}
                    onClick={() => handleCategorySelect(category)}
                    className={`flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      selectedCategory?.id === category.id ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-ledger-surface'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="mt-0.5 text-xs text-ink-muted">
                          {category.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}

          </div>

          {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="flex min-h-11 w-full items-center gap-2 border-t border-ledger-border px-4 text-left text-sm font-semibold text-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Custom Category</span>
              </button>
            ) : (
              <div className="border-t border-ledger-border p-3">
                <label htmlFor={`${controlId}-custom`} className="sr-only">Custom category name</label>
                <div className="flex gap-2">
                  <input
                    id={`${controlId}-custom`}
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category..."
                    className={`${ledgerControlClass} min-w-0 flex-1`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleCustomCategory();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCustomCategory}
                    className="min-h-11 rounded-control border border-accent bg-accent px-4 text-sm font-semibold text-surface-strong hover:border-accent-hover hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default WorkingCategorySelector;
