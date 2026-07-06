import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../../components/dashboard/StatCard';
import { TrendingUp, TrendingDown } from 'lucide-react';

describe('StatCard Component', () => {
  const mockStatData = {
    title: 'Total Balance',
    value: '$10,000',
    change: '+5.2%',
    trend: 'up' as const,
    lastUpdate: '2 hours ago',
    icon: TrendingUp,
    color: 'blue' as const,
  };

  it('should render with all props correctly', () => {
    render(<StatCard {...mockStatData} />);

    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
    expect(screen.getByText('+5.2%')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('should render with upward trend styling', () => {
    render(<StatCard {...mockStatData} />);

    const changeElement = screen.getByText('+5.2%');
    expect(changeElement).toHaveClass('text-accent');
  });

  it('should render with downward trend styling', () => {
    const downwardStat = {
      ...mockStatData,
      change: '-2.1%',
      trend: 'down' as const,
      icon: TrendingDown,
    };

    render(<StatCard {...downwardStat} />);

    const changeElement = screen.getByText('-2.1%');
    expect(changeElement).toHaveClass('text-danger');
  });

  it('should render without optional props', () => {
    const minimalStat = {
      title: 'Minimal Stat',
      value: '$1,000',
      icon: TrendingUp,
      color: 'green' as const,
    };

    render(<StatCard {...minimalStat} />);

    expect(screen.getByText('Minimal Stat')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('should apply correct color classes', () => {
    const { rerender } = render(<StatCard {...mockStatData} color="blue" />);
    expect(screen.getByTestId('stat-card')).toHaveClass('border-blue-200');

    rerender(<StatCard {...mockStatData} color="green" />);
    expect(screen.getByTestId('stat-card')).toHaveClass('border-green-200');

    rerender(<StatCard {...mockStatData} color="purple" />);
    expect(screen.getByTestId('stat-card')).toHaveClass('border-purple-200');

    rerender(<StatCard {...mockStatData} color="yellow" />);
    expect(screen.getByTestId('stat-card')).toHaveClass('border-yellow-200');
  });

  it('should render icon correctly', () => {
    render(<StatCard {...mockStatData} />);

    // Check if the icon is rendered (Lucide icons render as SVG)
    const iconElement = screen.getByTestId('stat-card').querySelector('svg');
    expect(iconElement).toBeInTheDocument();
  });

  it('should handle different value formats', () => {
    const testCases = [
      { value: '$1,234.56', expected: '$1,234.56' },
      { value: '1,234', expected: '1,234' },
      { value: '100%', expected: '100%' },
      { value: 'N/A', expected: 'N/A' },
    ];

    testCases.forEach(({ value, expected }) => {
      const { unmount } = render(
        <StatCard {...mockStatData} value={value} />
      );
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('should handle different change formats', () => {
    const testCases = [
      { change: '+5.2%', trend: 'up' as const },
      { change: '-3.1%', trend: 'down' as const },
      { change: '0%', trend: 'up' as const },
      { change: 'N/A', trend: 'up' as const },
    ];

    testCases.forEach(({ change, trend }) => {
      const { unmount } = render(
        <StatCard {...mockStatData} change={change} trend={trend} />
      );
      expect(screen.getByText(change)).toBeInTheDocument();
      unmount();
    });
  });
});












