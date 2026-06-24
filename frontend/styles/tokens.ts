/**
 * Design Tokens for Finance AI Dashboard
 * 
 * Centralized styling system for consistent UI across the app.
 * Built on top of Tailwind CSS with dark mode support.
 */

// ============================================
// COLOR TOKENS
// ============================================

export const v2Colors = {
  background: '#0A0A0B',
  surface: '#141416',
  border: '#1F1F23',
  textPrimary: '#FAFAFA',
  textSecondary: '#71717A',
  textMuted: '#52525B',
  accent: '#10B981',
  accentSubtle: '#10B98115',
  danger: '#EF4444',
} as const;

export const colors = {
  // V2 semantic tokens (raw values + Tailwind class aliases)
  v2: v2Colors,
  semantic: {
    background: 'bg-background',
    surface: 'bg-surface',
    border: 'border-border',
    textPrimary: 'text-text-primary',
    textSecondary: 'text-text-secondary',
    textMuted: 'text-text-muted',
    accent: 'text-accent',
    accentBg: 'bg-accent',
    accentSubtleBg: 'bg-accent-subtle',
    danger: 'text-danger',
    dangerBg: 'bg-danger',
  },

  // Base surface colors (most common pattern)
  surface: {
    base: 'bg-white dark:bg-surface',
    elevated: 'bg-gray-50 dark:bg-surface',
    overlay: 'bg-gray-100 dark:bg-border',
    hover: 'hover:bg-gray-50 dark:hover:bg-border',
  },

  // Border colors
  border: {
    default: 'border-gray-200 dark:border-border',
    light: 'border-gray-100 dark:border-border',
    dark: 'border-gray-300 dark:border-border',
  },

  // Text colors
  text: {
    primary: 'text-gray-900 dark:text-text-primary',
    secondary: 'text-gray-600 dark:text-text-secondary',
    tertiary: 'text-gray-500 dark:text-text-muted',
    disabled: 'text-gray-400 dark:text-gray-600',
    inverse: 'text-white dark:text-gray-900',
  },

  // Semantic state colors (for financial data)
  state: {
    positive: 'text-accent dark:text-accent',
    negative: 'text-danger dark:text-danger',
    neutral: 'text-text-secondary dark:text-text-secondary',
    warning: 'text-yellow-600 dark:text-yellow-400',
  },

  // Background state colors
  stateBg: {
    positive: 'bg-accent dark:bg-accent',
    negative: 'bg-danger dark:bg-danger',
    neutral: 'bg-text-muted dark:bg-text-muted',
    warning: 'bg-yellow-600 dark:bg-yellow-400',
  },

  // Brand gradients
  gradient: {
    primary: 'from-purple-600 to-blue-600',
    success: 'from-green-500 to-emerald-500',
    danger: 'from-red-500 to-pink-500',
    warning: 'from-orange-500 to-yellow-500',
    info: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-violet-500',
    teal: 'from-teal-500 to-green-500',
  },

  // Category-specific colors (for AI suggestions, cards, etc.)
  category: {
    savings: {
      bg: 'from-blue-500/10 to-blue-600/10',
      text: 'text-blue-900 dark:text-blue-300',
      border: 'border-blue-200/50 dark:border-blue-800/50',
      icon: 'bg-blue-500 text-white',
    },
    investment: {
      bg: 'from-green-500/10 to-green-600/10',
      text: 'text-green-900 dark:text-green-300',
      border: 'border-green-200/50 dark:border-green-800/50',
      icon: 'bg-green-500 text-white',
    },
    insurance: {
      bg: 'from-yellow-500/10 to-yellow-600/10',
      text: 'text-yellow-900 dark:text-yellow-300',
      border: 'border-yellow-200/50 dark:border-yellow-800/50',
      icon: 'bg-yellow-500 text-white',
    },
    budget: {
      bg: 'from-purple-500/10 to-purple-600/10',
      text: 'text-purple-900 dark:text-purple-300',
      border: 'border-purple-200/50 dark:border-purple-800/50',
      icon: 'bg-purple-500 text-white',
    },
  },

  // Icon background colors
  iconBg: {
    purple: 'bg-purple-100 dark:bg-purple-900/30',
    green: 'bg-green-100 dark:bg-green-900/30',
    pink: 'bg-pink-100 dark:bg-pink-900/30',
    blue: 'bg-blue-100 dark:bg-blue-900/30',
    gray: 'bg-gray-100 dark:bg-gray-900/30',
  },

  // Icon colors
  icon: {
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    pink: 'text-pink-600 dark:text-pink-400',
    blue: 'text-blue-600 dark:text-blue-400',
    gray: 'text-gray-500 dark:text-gray-400',
  },
} as const;

// ============================================
// COMPONENT TOKENS
// ============================================

export const components = {
  // Card variants
  card: {
    base: `${colors.surface.base} ${colors.border.default} rounded-xl shadow-sm hover:shadow-md transition-all duration-300`,
    interactive: `${colors.surface.base} ${colors.border.default} rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:scale-[1.02]`,
    elevated: `${colors.surface.elevated} ${colors.border.default} rounded-xl shadow-md hover:shadow-lg transition-all duration-300`,
    noBorder: `${colors.surface.base} rounded-xl shadow-sm hover:shadow-md transition-all duration-300`,
  },

  // Button variants
  button: {
    primary: 'premium-button px-6 py-3 rounded-lg font-semibold transition-all duration-300',
    secondary: `${colors.surface.overlay} ${colors.text.primary} px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300`,
    ghost: `${colors.text.primary} px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300`,
    icon: `p-2 ${colors.text.secondary} ${colors.surface.hover} rounded-lg transition-all duration-200`,
  },

  // Input variants
  input: {
    base: `premium-input w-full px-4 py-3 rounded-lg font-medium ${colors.border.default} focus:border-accent dark:focus:border-accent transition-all duration-200`,
    error: `premium-input w-full px-4 py-3 rounded-lg font-medium border-red-500 dark:border-red-400 focus:border-red-600 dark:focus:border-red-500 transition-all duration-200`,
  },

  // Navigation items
  nav: {
    base: `flex items-center space-x-3 px-4 py-3 rounded-lg ${colors.text.primary} font-medium transition-all duration-200 group`,
    active: `flex items-center space-x-3 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-accent-subtle text-emerald-700 dark:text-accent border-r-2 border-accent font-medium transition-all duration-200 group`,
    hover: `${colors.surface.hover} hover:text-gray-900 dark:hover:text-white`,
  },

  // Badge variants
  badge: {
    success: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300`,
    danger: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300`,
    warning: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300`,
    info: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300`,
  },

  // Premium backgrounds (from your index.css)
  premiumBg: {
    subtle: 'premium-bg-subtle',
    warm: 'premium-bg-warm',
    cool: 'premium-bg-cool',
    purple: 'premium-bg-purple',
  },
} as const;

// ============================================
// LAYOUT TOKENS
// ============================================

export const layout = {
  spacing: {
    section: 'space-y-8',
    card: 'p-6',
    cardSm: 'p-4',
    cardLg: 'p-8',
  },

  container: {
    full: 'w-full',
    centered: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  },

  grid: {
    responsive: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    twoCol: 'grid grid-cols-1 lg:grid-cols-2 gap-6',
    threeCol: 'grid grid-cols-1 lg:grid-cols-3 gap-6',
  },
} as const;

// ============================================
// ANIMATION TOKENS
// ============================================

export const animations = {
  transition: {
    fast: 'transition-all duration-200',
    normal: 'transition-all duration-300',
    slow: 'transition-all duration-500',
  },

  hover: {
    scale: 'hover:scale-[1.02] transition-transform duration-300',
    lift: 'hover:-translate-y-1 transition-transform duration-300',
    glow: 'hover:shadow-lg transition-shadow duration-300',
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Combine multiple token classes
 * Usage: cn(colors.surface.base, components.card.base)
 */
export const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');

/**
 * Get category styling based on type
 */
export const getCategoryStyle = (type: 'savings' | 'investment' | 'insurance' | 'budget') => {
  return colors.category[type];
};

/**
 * Get state color based on type
 */
export const getStateColor = (state: 'positive' | 'negative' | 'neutral' | 'warning') => {
  return colors.state[state];
};

/**
 * Get state icon based on type
 */
export const getStateIcon = (state: 'positive' | 'negative' | 'neutral') => {
  const icons = {
    positive: '↗',
    negative: '↘',
    neutral: '→',
  };
  return icons[state];
};

