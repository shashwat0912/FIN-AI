import React from 'react';
import StatCard from './StatCard';
import { TrendingUp, TrendingDown, DollarSign, Target, PiggyBank, BarChart3 } from 'lucide-react';

export default function StatsCards() {
  const stats = [
    {
      title: 'Total Balance',
      value: '₹2,45,680',
      change: '+12.5%',
      changeType: 'positive',
      icon: DollarSign
    },
    {
      title: 'Income',
      value: '₹85,420',
      change: '+8.2%',
      changeType: 'positive',
      icon: TrendingUp
    },
    {
      title: 'Expenses',
      value: '₹62,340',
      change: '-3.1%',
      changeType: 'negative',
      icon: TrendingDown
    },
    {
      title: 'Savings Rate',
      value: '27.3%',
      change: '+2.8%',
      changeType: 'positive',
      icon: Target
    },
    {
      title: 'Investments',
      value: '₹1,23,450',
      change: '+15.7%',
      changeType: 'positive',
      icon: BarChart3
    },
    {
      title: 'Emergency Fund',
      value: '₹3,50,000',
      change: 'Fully Funded',
      changeType: 'neutral',
      icon: PiggyBank
    }
  ];

  const primaryStats = stats.slice(0, 3);
  const secondaryStats = stats.slice(3);

  return (
    <div className="mb-8 space-y-3">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        {primaryStats.map((stat) => (
          <StatCard key={stat.title} {...stat} variant="primary" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        {secondaryStats.map((stat) => (
          <StatCard key={stat.title} {...stat} variant="secondary" />
        ))}
      </div>
    </div>
  );
}
