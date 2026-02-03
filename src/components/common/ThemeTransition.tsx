import React, { ReactNode } from 'react';
import { useDarkMode } from '../../context/DarkModeContext';

interface ThemeTransitionProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  animation?: 'fade' | 'slide' | 'scale' | 'glow';
  delay?: number;
}

export default function ThemeTransition({ 
  children, 
  className = '', 
  stagger = 0,
  animation = 'fade',
  delay = 0
}: ThemeTransitionProps) {
  const { isTransitioning } = useDarkMode();

  const getAnimationClass = () => {
    if (!isTransitioning) return '';
    
    const baseAnimation = `animate-theme-${animation}`;
    const staggerClass = stagger > 0 ? `animate-stagger-${stagger}` : '';
    const delayClass = delay > 0 ? `delay-${delay}` : '';
    
    return `${baseAnimation} ${staggerClass} ${delayClass}`.trim();
  };

  return (
    <div 
      className={`
        ${className}
        ${getAnimationClass()}
        theme-transition-smooth
      `}
    >
      {children}
    </div>
  );
}

// Specialized transition components for common use cases
export function ThemeFade({ children, className = '', stagger = 0 }: Omit<ThemeTransitionProps, 'animation'>) {
  return (
    <ThemeTransition animation="fade" className={className} stagger={stagger}>
      {children}
    </ThemeTransition>
  );
}

export function ThemeSlide({ children, className = '', stagger = 0 }: Omit<ThemeTransitionProps, 'animation'>) {
  return (
    <ThemeTransition animation="slide" className={className} stagger={stagger}>
      {children}
    </ThemeTransition>
  );
}

export function ThemeScale({ children, className = '', stagger = 0 }: Omit<ThemeTransitionProps, 'animation'>) {
  return (
    <ThemeTransition animation="scale" className={className} stagger={stagger}>
      {children}
    </ThemeTransition>
  );
}

export function ThemeGlow({ children, className = '', stagger = 0 }: Omit<ThemeTransitionProps, 'animation'>) {
  return (
    <ThemeTransition animation="glow" className={className} stagger={stagger}>
      {children}
    </ThemeTransition>
  );
}



