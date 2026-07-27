export type CategoryType = 'income' | 'expense';

export interface CanonicalCategory {
  key: string;
  label: string;
  type: CategoryType;
  aliases: readonly string[];
}

export const CATEGORY_REGISTRY: readonly CanonicalCategory[] = [
  { key: 'salary-wages', label: 'Salary/Wages', type: 'income', aliases: ['salary', 'wages', 'payroll', 'paycheck', 'pay day', 'payslip', 'ctc', 'salay', 'sallary'] },
  { key: 'business-income', label: 'Business Income', type: 'income', aliases: ['business', 'business revenue', 'sales revenue'] },
  { key: 'freelancing-consulting', label: 'Freelancing/Consulting', type: 'income', aliases: ['freelance', 'freelancing', 'consulting', 'consultancy', 'client payment'] },
  { key: 'investment-returns', label: 'Investment Returns', type: 'income', aliases: ['investment return', 'investment returns', 'redemption'] },
  { key: 'rental-income', label: 'Rental Income', type: 'income', aliases: ['rent income', 'rental income'] },
  { key: 'interest-income', label: 'Interest Income', type: 'income', aliases: ['interest', 'bank interest', 'fd interest'] },
  { key: 'dividend-income', label: 'Dividend Income', type: 'income', aliases: ['dividend', 'dividends'] },
  { key: 'capital-gains', label: 'Capital Gains', type: 'income', aliases: ['capital gain', 'capital gains', 'stock profit'] },

  { key: 'food-dining', label: 'Food & Dining', type: 'expense', aliases: ['food', 'dining', 'food and dining'] },
  { key: 'groceries-household', label: 'Groceries & Household', type: 'expense', aliases: ['grocery', 'groceries', 'household', 'groceries and household'] },
  { key: 'transportation', label: 'Transportation', type: 'expense', aliases: ['transport', 'commute', 'commuting'] },
  { key: 'fuel-vehicle-maintenance', label: 'Fuel & Vehicle Maintenance', type: 'expense', aliases: ['fuel', 'petrol', 'diesel', 'vehicle maintenance', 'fuel and vehicle maintenance'] },
  { key: 'mobile-internet-bills', label: 'Mobile & Internet Bills', type: 'expense', aliases: ['mobile', 'internet', 'phone', 'mobile bills', 'internet bills', 'mobile and internet bills'] },
  { key: 'utilities', label: 'Utilities', type: 'expense', aliases: ['utility', 'electricity', 'water bill', 'gas bill'] },
  { key: 'emi-payments', label: 'EMI Payments', type: 'expense', aliases: ['emi', 'loan', 'loan payment', 'debt payment'] },
  { key: 'insurance-premiums', label: 'Insurance Premiums', type: 'expense', aliases: ['insurance', 'insurance premium', 'premium'] },
  { key: 'house-rent-maintenance', label: 'House Rent/Maintenance', type: 'expense', aliases: ['rent', 'housing', 'house rent', 'home maintenance', 'house rent maintenance'] },
  { key: 'domestic-help', label: 'Domestic Help', type: 'expense', aliases: ['maid', 'cook', 'domestic worker'] },
  { key: 'medical-healthcare', label: 'Medical & Healthcare', type: 'expense', aliases: ['health', 'healthcare', 'medical', 'medicine', 'medical and healthcare'] },
  { key: 'education-courses', label: 'Education & Courses', type: 'expense', aliases: ['education', 'course', 'courses', 'tuition', 'education and courses'] },
  { key: 'religious-donations', label: 'Religious & Donations', type: 'expense', aliases: ['religious', 'donation', 'donations', 'charity', 'religious and donations'] },
  { key: 'mutual-fund-sip', label: 'Mutual Fund SIP', type: 'expense', aliases: ['investment', 'investments', 'mutual fund', 'mutual funds', 'sip'] },
  { key: 'fixed-deposits', label: 'Fixed Deposits', type: 'expense', aliases: ['fixed deposit', 'fd'] },
  { key: 'gold-jewelry', label: 'Gold/Jewelry', type: 'expense', aliases: ['gold', 'jewelry', 'jewellery'] },
  { key: 'real-estate', label: 'Real Estate', type: 'expense', aliases: ['property'] },
  { key: 'entertainment-movies', label: 'Entertainment & Movies', type: 'expense', aliases: ['entertainment', 'movie', 'movies', 'cinema', 'entertainment and movies'] },
  { key: 'shopping-clothing', label: 'Shopping & Clothing', type: 'expense', aliases: ['shopping', 'clothing', 'clothes', 'shopping and clothing'] },
  { key: 'travel-vacation', label: 'Travel & Vacation', type: 'expense', aliases: ['travel', 'vacation', 'holiday', 'travel and vacation'] },
  { key: 'gifts-celebrations', label: 'Gifts & Celebrations', type: 'expense', aliases: ['gift', 'gifts', 'celebration', 'celebrations', 'gifts and celebrations'] },
  { key: 'personal-care-beauty', label: 'Personal Care & Beauty', type: 'expense', aliases: ['personal care', 'beauty', 'grooming', 'personal care and beauty'] },
  { key: 'haircut-salon-services', label: 'Haircut & Salon Services', type: 'expense', aliases: ['haircut', 'salon', 'haircut and salon services'] },
  { key: 'spa-beauty-treatments', label: 'Spa & Beauty Treatments', type: 'expense', aliases: ['spa', 'facial', 'massage', 'spa and beauty treatments'] },
  { key: 'personal-care-products', label: 'Personal Care Products', type: 'expense', aliases: ['shampoo', 'soap', 'deodorant', 'hygiene'] },
  { key: 'sexual-wellness-contraceptives', label: 'Sexual Wellness & Contraceptives', type: 'expense', aliases: ['sexual wellness', 'contraceptives', 'sexual wellness and contraceptives'] },
  { key: 'cosmetics-skincare', label: 'Cosmetics & Skincare', type: 'expense', aliases: ['cosmetics', 'skincare', 'makeup', 'cosmetics and skincare'] },
  { key: 'gym-fitness', label: 'Gym & Fitness', type: 'expense', aliases: ['gym', 'fitness', 'workout', 'exercise', 'gym and fitness'] },
];

const normalizeLookupText = (value: string) => value
  .normalize('NFKC')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const lookup = new Map<string, CanonicalCategory>();
for (const category of CATEGORY_REGISTRY) {
  for (const value of [category.key, category.label, ...category.aliases]) {
    lookup.set(`${category.type}:${normalizeLookupText(value)}`, category);
  }
}

export function normalizeCategory(
  value: string | null | undefined,
  type: CategoryType
): CanonicalCategory | null {
  const normalized = normalizeLookupText(value || '');
  return normalized ? lookup.get(`${type}:${normalized}`) || null : null;
}
