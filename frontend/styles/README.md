# Design Tokens System

A centralized, type-safe design token system for the Finance AI Dashboard. Built on Tailwind CSS with full dark mode support.

## Overview

This design system eliminates hardcoded styling and provides:
- ✅ **Consistency** - Single source of truth for colors, spacing, and components
- ✅ **Type Safety** - Full TypeScript support with autocomplete
- ✅ **Dark Mode** - Built-in dark mode support for all tokens
- ✅ **Maintainability** - Change once, apply everywhere
- ✅ **Zero Runtime Cost** - Compile-time constants, no performance impact

## Usage

### Basic Import

```typescript
import { colors, components, layout, animations } from '../styles/tokens';
```

### Color Tokens

#### Surface Colors
```tsx
// Base surfaces
<div className={colors.surface.base}>        // bg-white dark:bg-dark-900
<div className={colors.surface.elevated}>    // bg-gray-50 dark:bg-dark-800
<div className={colors.surface.overlay}>     // bg-gray-100 dark:bg-dark-800
```

#### Text Colors
```tsx
<h1 className={colors.text.primary}>         // text-gray-900 dark:text-white
<p className={colors.text.secondary}>        // text-gray-600 dark:text-gray-400
<span className={colors.text.tertiary}>      // text-gray-500 dark:text-gray-500
```

#### State Colors (Financial Data)
```tsx
import { getStateColor } from '../styles/tokens';

// Programmatic usage
<span className={getStateColor('positive')}>  // text-green-600 dark:text-green-400
<span className={getStateColor('negative')}>  // text-red-600 dark:text-red-400
<span className={getStateColor('neutral')}>   // text-blue-600 dark:text-blue-400

// Direct usage
<span className={colors.state.positive}>
<span className={colors.state.negative}>
```

#### Borders
```tsx
<div className={`border ${colors.border.default}`}>  // border-gray-200 dark:border-dark-700
<div className={`border ${colors.border.light}`}>    // border-gray-100 dark:border-dark-800
```

#### Gradients
```tsx
<div className={`bg-gradient-to-r ${colors.gradient.primary}`}>  // from-purple-600 to-blue-600
<div className={`bg-gradient-to-r ${colors.gradient.success}`}>  // from-green-500 to-emerald-500
```

### Component Tokens

#### Cards
```tsx
// Standard card
<div className={components.card.base}>
  Content
</div>

// Interactive card (clickable)
<div className={components.card.interactive}>
  Clickable content
</div>

// Elevated card
<div className={components.card.elevated}>
  Prominent content
</div>
```

#### Buttons
```tsx
// Primary button
<button className={components.button.primary}>
  Click me
</button>

// Secondary button
<button className={components.button.secondary}>
  Cancel
</button>

// Icon button
<button className={components.button.icon}>
  <Icon />
</button>
```

#### Navigation
```tsx
<NavLink
  className={({ isActive }) => 
    isActive ? components.nav.active : `${components.nav.base} ${components.nav.hover}`
  }
>
  Dashboard
</NavLink>
```

### Layout Tokens

```tsx
// Spacing
<div className={layout.spacing.section}>     // space-y-8
<div className={layout.spacing.card}>        // p-6

// Grids
<div className={layout.grid.responsive}>     // grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
<div className={layout.grid.threeCol}>       // grid grid-cols-1 lg:grid-cols-3 gap-6
```

### Animation Tokens

```tsx
<div className={animations.transition.fast}>    // transition-all duration-200
<div className={animations.transition.normal}>  // transition-all duration-300
<div className={animations.hover.scale}>        // hover:scale-[1.02]
```

### Helper Functions

#### getCategoryStyle
```tsx
import { getCategoryStyle } from '../styles/tokens';

const categoryStyle = getCategoryStyle('savings');
// Returns: { bg, text, border, icon } with all dark mode variants
```

#### getStateIcon
```tsx
import { getStateIcon } from '../styles/tokens';

const icon = getStateIcon('positive');  // Returns: '↗'
```

#### cn (Class Name Combiner)
```tsx
import { cn } from '../styles/tokens';

<div className={cn(colors.surface.base, components.card.base, 'custom-class')}>
```

## Best Practices

### ✅ DO

```tsx
// Use semantic tokens
<div className={colors.surface.base}>
<p className={colors.text.secondary}>

// Use helper functions for dynamic values
const color = getStateColor(changeType);

// Combine tokens for complex components
<div className={`${components.card.base} ${layout.spacing.card}`}>
```

### ❌ DON'T

```tsx
// Don't hardcode colors
<div className="bg-white dark:bg-dark-900">  // Use colors.surface.base instead

// Don't duplicate repeated patterns
<div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl shadow-sm">
// Use components.card.base instead

// Don't mix hardcoded and token styles in same component
<div className={`${colors.surface.base} border-red-500`}>
// If you need custom border, extract it to tokens
```

## Security Considerations

1. **XSS Prevention**: All tokens are string constants, preventing injection attacks
2. **Type Safety**: TypeScript ensures only valid tokens are used
3. **No Runtime Evaluation**: All classes are static, no `dangerouslySetInnerHTML` patterns
4. **Sanitized Output**: Tailwind's JIT compiler validates all classes

## Extending the System

### Adding New Colors

```typescript
// In tokens.ts
export const colors = {
  // ... existing colors
  newCategory: {
    light: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  }
} as const;
```

### Adding New Components

```typescript
export const components = {
  // ... existing components
  modal: {
    base: `${colors.surface.base} rounded-2xl shadow-2xl p-6`,
    backdrop: 'fixed inset-0 bg-black/50 backdrop-blur-sm',
  }
} as const;
```

## Migration Guide

### From Hardcoded to Tokens

**Before:**
```tsx
<div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6">
```

**After:**
```tsx
import { components, layout } from '../styles/tokens';

<div className={`${components.card.base} ${layout.spacing.card}`}>
```

**Result:**
- 135 characters → 62 characters (54% reduction)
- One place to change styling
- Type-safe and autocomplete-friendly

## Performance

- **Bundle Size**: ~2KB additional (minified, gzipped)
- **Runtime Cost**: Zero - all compile-time constants
- **Build Time**: No impact - Tailwind JIT handles all classes

## Troubleshooting

### Styles not applying?

1. Ensure Tailwind config includes the tokens file:
```javascript
// tailwind.config.js
content: [
  "./src/**/*.{js,ts,jsx,tsx}",
  "./src/styles/tokens.ts"  // Include tokens
]
```

2. Check import path is correct:
```typescript
import { colors } from '../styles/tokens';  // Adjust ../ based on file location
```

### TypeScript errors?

Ensure you're using `as const` for type narrowing:
```typescript
const theme = { primary: '#purple' } as const;
```

## Examples

See these files for reference implementations:
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/AiSuggestion.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/pages/Dashboard.tsx`

---

**Questions or Suggestions?** This system is designed to grow with your needs. Add tokens as you discover patterns!


