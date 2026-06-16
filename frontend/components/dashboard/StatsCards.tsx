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
      icon: DollarSign,
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Monthly Income',
      value: '₹85,420',
      change: '+8.2%',
      changeType: 'positive',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Monthly Expenses',
      value: '₹62,340',
      change: '-3.1%',
      changeType: 'negative',
      icon: TrendingDown,
      gradient: 'from-red-500 to-pink-500',
      bgGradient: 'from-red-50 to-pink-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Savings Rate',
      value: '27.3%',
      change: '+2.8%',
      changeType: 'positive',
      icon: Target,
      gradient: 'from-purple-500 to-violet-500',
      bgGradient: 'from-purple-50 to-violet-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Investment Growth',
      value: '₹1,23,450',
      change: '+15.7%',
      changeType: 'positive',
      icon: BarChart3,
      gradient: 'from-orange-500 to-yellow-500',
      bgGradient: 'from-orange-50 to-yellow-50',
      borderColor: 'border-orange-200'
    },
    {
      title: 'Emergency Fund',
      value: '₹3,50,000',
      change: 'Fully Funded',
      changeType: 'neutral',
      icon: PiggyBank,
      gradient: 'from-teal-500 to-green-500',
      bgGradient: 'from-teal-50 to-green-50',
      borderColor: 'border-teal-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((stat, index) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}