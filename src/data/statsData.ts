import { Wallet, PiggyBank, TrendingUp, BrainCircuit } from 'lucide-react';
import { StatData } from '../types';

export const statsData: StatData[] = [
  {
    title: 'Total Balance',
    value: '₹5,400',
    change: '+2.5%',
    trend: 'up',
    icon: Wallet,
    color: 'blue'
  },
  {
    title: 'Monthly Savings',
    value: '₹850',
    change: '+12.3%',
    trend: 'up',
    icon: PiggyBank,
    color: 'green'
  },
  {
    title: 'Investments',
    value: '₹2,150',
    change: '-1.2%',
    trend: 'down',
    icon: TrendingUp,
    color: 'purple'
  },
  {
    title: 'AI Insights',
    value: '4 New',
    lastUpdate: 'Updated 2h ago',
    icon: BrainCircuit,
    color: 'yellow'
  }
];