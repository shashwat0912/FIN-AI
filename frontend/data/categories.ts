/**
 * Transaction Categories for Indian Users
 * Organized by type and grouped for better UX
 */

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  group: string;
  color: string;
  description?: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const categoryGroups: CategoryGroup[] = [
  {
    id: 'daily-essentials',
    name: 'Daily Essentials',
    description: 'Everyday expenses and necessities',
    color: 'blue'
  },
  {
    id: 'financial-obligations',
    name: 'Financial Obligations',
    description: 'Regular payments and commitments',
    color: 'red'
  },
  {
    id: 'investments',
    name: 'Investments & Savings',
    description: 'Money set aside for future',
    color: 'green'
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle & Entertainment',
    description: 'Personal enjoyment and leisure',
    color: 'purple'
  },
  {
    id: 'income-sources',
    name: 'Income Sources',
    description: 'Various ways you earn money',
    color: 'emerald'
  },
  {
    id: 'personal-care',
    name: 'Personal Care & Grooming',
    description: 'Self-care, beauty, and wellness expenses',
    color: 'pink'
  }
];

export const incomeCategories: Category[] = [
  // Primary Income
  {
    id: 'salary-wages',
    name: 'Salary/Wages',
    icon: 'Briefcase',
    type: 'income',
    group: 'income-sources',
    color: 'emerald',
    description: 'Regular employment income'
  },
  {
    id: 'business-income',
    name: 'Business Income',
    icon: 'Building2',
    type: 'income',
    group: 'income-sources',
    color: 'emerald',
    description: 'Income from business operations'
  },
  {
    id: 'freelancing-consulting',
    name: 'Freelancing/Consulting',
    icon: 'Laptop',
    type: 'income',
    group: 'income-sources',
    color: 'emerald',
    description: 'Independent contractor work'
  },
  
  // Investment Returns
  {
    id: 'investment-returns',
    name: 'Investment Returns',
    icon: 'TrendingUp',
    type: 'income',
    group: 'income-sources',
    color: 'green',
    description: 'Returns from investments'
  },
  {
    id: 'rental-income',
    name: 'Rental Income',
    icon: 'Home',
    type: 'income',
    group: 'income-sources',
    color: 'green',
    description: 'Income from property rental'
  },
  {
    id: 'interest-income',
    name: 'Interest Income',
    icon: 'Percent',
    type: 'income',
    group: 'income-sources',
    color: 'green',
    description: 'Interest from savings and deposits'
  },
  {
    id: 'dividend-income',
    name: 'Dividend Income',
    icon: 'DollarSign',
    type: 'income',
    group: 'income-sources',
    color: 'green',
    description: 'Dividends from stocks and mutual funds'
  },
  {
    id: 'capital-gains',
    name: 'Capital Gains',
    icon: 'ArrowUpRight',
    type: 'income',
    group: 'income-sources',
    color: 'green',
    description: 'Profits from asset sales'
  }
];

export const expenseCategories: Category[] = [
  // Daily Essentials
  {
    id: 'food-dining',
    name: 'Food & Dining',
    icon: 'Utensils',
    type: 'expense',
    group: 'daily-essentials',
    color: 'blue',
    description: 'Restaurants, cafes, and food delivery'
  },
  {
    id: 'groceries-household',
    name: 'Groceries & Household',
    icon: 'ShoppingCart',
    type: 'expense',
    group: 'daily-essentials',
    color: 'blue',
    description: 'Grocery shopping and household items'
  },
  {
    id: 'transportation',
    name: 'Transportation',
    icon: 'Car',
    type: 'expense',
    group: 'daily-essentials',
    color: 'blue',
    description: 'Auto, taxi, metro, and public transport'
  },
  {
    id: 'fuel-vehicle-maintenance',
    name: 'Fuel & Vehicle Maintenance',
    icon: 'Fuel',
    type: 'expense',
    group: 'daily-essentials',
    color: 'blue',
    description: 'Petrol, diesel, and vehicle upkeep'
  },
  {
    id: 'mobile-internet-bills',
    name: 'Mobile & Internet Bills',
    icon: 'Smartphone',
    type: 'expense',
    group: 'daily-essentials',
    color: 'blue',
    description: 'Phone and internet service bills'
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: 'Zap',
    type: 'expense',
    group: 'daily-essentials',
    color: 'blue',
    description: 'Electricity, water, and gas bills'
  },

  // Financial Obligations
  {
    id: 'emi-payments',
    name: 'EMI Payments',
    icon: 'CreditCard',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'Loan and credit card EMIs'
  },
  {
    id: 'insurance-premiums',
    name: 'Insurance Premiums',
    icon: 'Shield',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'Life, health, and vehicle insurance'
  },
  {
    id: 'house-rent-maintenance',
    name: 'House Rent/Maintenance',
    icon: 'Home',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'Rent and home maintenance costs'
  },
  {
    id: 'domestic-help',
    name: 'Domestic Help',
    icon: 'Users',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'Maid, cook, and domestic worker payments'
  },
  {
    id: 'medical-healthcare',
    name: 'Medical & Healthcare',
    icon: 'Heart',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'Medical bills, medicines, and healthcare'
  },
  {
    id: 'education-courses',
    name: 'Education & Courses',
    icon: 'BookOpen',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'School fees, courses, and educational expenses'
  },
  {
    id: 'religious-donations',
    name: 'Religious & Donations',
    icon: 'HandHeart',
    type: 'expense',
    group: 'financial-obligations',
    color: 'red',
    description: 'Temple donations and charitable giving'
  },

  // Investments & Savings
  {
    id: 'mutual-fund-sip',
    name: 'Mutual Fund SIP',
    icon: 'TrendingUp',
    type: 'expense',
    group: 'investments',
    color: 'green',
    description: 'Systematic Investment Plans'
  },
  {
    id: 'fixed-deposits',
    name: 'Fixed Deposits',
    icon: 'PiggyBank',
    type: 'expense',
    group: 'investments',
    color: 'green',
    description: 'Fixed deposit investments'
  },
  {
    id: 'gold-jewelry',
    name: 'Gold/Jewelry',
    icon: 'Gem',
    type: 'expense',
    group: 'investments',
    color: 'green',
    description: 'Gold and jewelry purchases'
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    icon: 'Building',
    type: 'expense',
    group: 'investments',
    color: 'green',
    description: 'Property and real estate investments'
  },

  // Lifestyle & Entertainment
  {
    id: 'entertainment-movies',
    name: 'Entertainment & Movies',
    icon: 'Film',
    type: 'expense',
    group: 'lifestyle',
    color: 'purple',
    description: 'Movies, shows, and entertainment'
  },
  {
    id: 'shopping-clothing',
    name: 'Shopping & Clothing',
    icon: 'ShoppingBag',
    type: 'expense',
    group: 'lifestyle',
    color: 'purple',
    description: 'Clothing and personal shopping'
  },
  {
    id: 'travel-vacation',
    name: 'Travel & Vacation',
    icon: 'Plane',
    type: 'expense',
    group: 'lifestyle',
    color: 'purple',
    description: 'Travel and vacation expenses'
  },
  {
    id: 'gifts-celebrations',
    name: 'Gifts & Celebrations',
    icon: 'Gift',
    type: 'expense',
    group: 'lifestyle',
    color: 'purple',
    description: 'Gifts and celebration expenses'
  },
  {
    id: 'personal-care-beauty',
    name: 'Personal Care & Beauty',
    icon: 'Sparkles',
    type: 'expense',
    group: 'lifestyle',
    color: 'purple',
    description: 'Beauty, grooming, and personal care'
  },

  // Personal Care & Grooming (New & Premium section)
  {
    id: 'haircut-salon-services',
    name: 'Haircut & Salon Services',
    icon: 'Scissors',
    type: 'expense',
    group: 'personal-care',
    color: 'pink',
    description: 'Haircuts, styling, and salon services'
  },
  {
    id: 'spa-beauty-treatments',
    name: 'Spa & Beauty Treatments',
    icon: 'Sparkles',
    type: 'expense',
    group: 'personal-care',
    color: 'pink',
    description: 'Spa treatments, facials, and beauty services'
  },
  {
    id: 'personal-care-products',
    name: 'Personal Care Products',
    icon: 'Droplets',
    type: 'expense',
    group: 'personal-care',
    color: 'pink',
    description: 'Shampoo, soap, deodorant, and personal hygiene products'
  },
  {
    id: 'sexual-wellness-contraceptives',
    name: 'Sexual Wellness & Contraceptives',
    icon: 'Heart',
    type: 'expense',
    group: 'personal-care',
    color: 'pink',
    description: 'Contraceptives, sexual health products, and wellness items'
  },
  {
    id: 'cosmetics-skincare',
    name: 'Cosmetics & Skincare',
    icon: 'Palette',
    type: 'expense',
    group: 'personal-care',
    color: 'pink',
    description: 'Makeup, skincare products, and beauty cosmetics'
  },
  {
    id: 'gym-fitness',
    name: 'Gym & Fitness',
    icon: 'Dumbbell',
    type: 'expense',
    group: 'personal-care',
    color: 'pink',
    description: 'Gym membership, fitness classes, and workout equipment'
  }
];

export const allCategories: Category[] = [...incomeCategories, ...expenseCategories];

// Smart suggestions mapping
export const smartSuggestions: Record<string, string[]> = {
  // Food related
  'movie': ['entertainment-movies'],
  'cinema': ['entertainment-movies'],
  'restaurant': ['food-dining'],
  'food': ['food-dining'],
  'grocery': ['groceries-household'],
  'vegetables': ['groceries-household'],
  'milk': ['groceries-household'],
  
  // Transportation
  'petrol': ['fuel-vehicle-maintenance'],
  'diesel': ['fuel-vehicle-maintenance'],
  'fuel': ['fuel-vehicle-maintenance'],
  'taxi': ['transportation'],
  'uber': ['transportation'],
  'ola': ['transportation'],
  'metro': ['transportation'],
  'bus': ['transportation'],
  
  // Utilities
  'electricity': ['utilities'],
  'water': ['utilities'],
  'gas': ['utilities'],
  'internet': ['mobile-internet-bills'],
  'mobile': ['mobile-internet-bills'],
  'phone': ['mobile-internet-bills'],
  
  // Financial
  'emi': ['emi-payments'],
  'loan': ['emi-payments'],
  'insurance': ['insurance-premiums'],
  'premium': ['insurance-premiums'],
  'rent': ['house-rent-maintenance'],
  'maintenance': ['house-rent-maintenance'],
  
  // Medical
  'medicine': ['medical-healthcare'],
  'doctor': ['medical-healthcare'],
  'hospital': ['medical-healthcare'],
  'medical': ['medical-healthcare'],
  
  // Education
  'school': ['education-courses'],
  'college': ['education-courses'],
  'course': ['education-courses'],
  'education': ['education-courses'],
  
  // Shopping
  'clothes': ['shopping-clothing'],
  'shopping': ['shopping-clothing'],
  'clothing': ['shopping-clothing'],
  
  // Travel
  'travel': ['travel-vacation'],
  'vacation': ['travel-vacation'],
  'hotel': ['travel-vacation'],
  'flight': ['travel-vacation'],
  
  // Gifts
  'gift': ['gifts-celebrations'],
  'birthday': ['gifts-celebrations'],
  'wedding': ['gifts-celebrations'],
  'celebration': ['gifts-celebrations'],
  
  // Personal care
  'beauty': ['personal-care-beauty'],
  'salon': ['personal-care-beauty'],
  'spa': ['personal-care-beauty'],
  'grooming': ['personal-care-beauty'],
  
  // Personal Care & Grooming (New & Premium)
  'haircut': ['haircut-salon-services'],
  'hair': ['haircut-salon-services'],
  'facial': ['spa-beauty-treatments'],
  'massage': ['spa-beauty-treatments'],
  'shampoo': ['personal-care-products'],
  'soap': ['personal-care-products'],
  'deodorant': ['personal-care-products'],
  'hygiene': ['personal-care-products'],
  'makeup': ['cosmetics-skincare'],
  'cosmetics': ['cosmetics-skincare'],
  'skincare': ['cosmetics-skincare'],
  'gym': ['gym-fitness'],
  'fitness': ['gym-fitness'],
  'workout': ['gym-fitness'],
  'exercise': ['gym-fitness']
};

// Helper functions
export const getCategoriesByType = (type: 'income' | 'expense'): Category[] => {
  return allCategories.filter(category => category.type === type);
};

export const getCategoriesByGroup = (group: string): Category[] => {
  return allCategories.filter(category => category.group === group);
};

export const getCategoryById = (id: string): Category | undefined => {
  return allCategories.find(category => category.id === id);
};

export const getSmartSuggestions = (description: string): Category[] => {
  const lowerDesc = description.toLowerCase();
  const suggestedIds = new Set<string>();
  
  // Check for exact matches
  Object.entries(smartSuggestions).forEach(([keyword, categoryIds]) => {
    if (lowerDesc.includes(keyword)) {
      categoryIds.forEach(id => suggestedIds.add(id));
    }
  });
  
  // Check for partial matches
  Object.entries(smartSuggestions).forEach(([keyword, categoryIds]) => {
    if (lowerDesc.includes(keyword.substring(0, 3))) {
      categoryIds.forEach(id => suggestedIds.add(id));
    }
  });
  
  return Array.from(suggestedIds)
    .map(id => getCategoryById(id))
    .filter(Boolean) as Category[];
};

export const getRecentCategories = (recentCategoryIds: string[]): Category[] => {
  return recentCategoryIds
    .map(id => getCategoryById(id))
    .filter(Boolean) as Category[];
};
