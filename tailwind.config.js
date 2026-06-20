/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./frontend/**/*.{js,ts,jsx,tsx}",
    "./backend/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Premium dark mode palette
        dark: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#9aa0a6',
          600: '#80868b',
          700: '#5f6368',
          800: '#3c4043',
          900: '#202124',
          950: '#121212', // Deep premium dark
        },
        // Soft accent colors for dark mode
        accent: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'theme-slide-in': 'themeSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        'theme-fade-in': 'themeFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        'theme-glow': 'themeGlow 1s ease-in-out',
        'theme-pulse': 'themePulse 0.6s ease-in-out',
        'theme-rotate': 'themeRotate 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        'stagger-1': 'fadeIn 0.5s ease-in-out 0.1s both',
        'stagger-2': 'fadeIn 0.5s ease-in-out 0.2s both',
        'stagger-3': 'fadeIn 0.5s ease-in-out 0.3s both',
        'stagger-4': 'fadeIn 0.5s ease-in-out 0.4s both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        themeSlideIn: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(20px) scale(0.95)' 
          },
          '50%': { 
            opacity: '0.8', 
            transform: 'translateY(-5px) scale(1.02)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0) scale(1)' 
          },
        },
        themeFadeIn: {
          '0%': { 
            opacity: '0', 
            transform: 'scale(0.9)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
        themeGlow: {
          '0%': { 
            boxShadow: '0 0 0 rgba(99, 102, 241, 0)' 
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)' 
          },
          '100%': { 
            boxShadow: '0 0 0 rgba(99, 102, 241, 0)' 
          },
        },
        themePulse: {
          '0%, 100%': { 
            transform: 'scale(1)' 
          },
          '50%': { 
            transform: 'scale(1.05)' 
          },
        },
        themeRotate: {
          'from': { 
            transform: 'rotate(0deg) scale(1)' 
          },
          'to': { 
            transform: 'rotate(360deg) scale(1)' 
          },
        },
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      transitionDuration: {
        'theme': '800ms',
        'theme-fast': '400ms',
        'theme-slow': '1200ms',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}