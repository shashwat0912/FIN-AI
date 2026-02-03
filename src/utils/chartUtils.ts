import { format, subMonths } from 'date-fns';

export interface ChartDataPoint {
  name: string;
  balance: number;
  previousBalance: number;
  date: Date;
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export const generateChartData = (months: number = 6): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const today = new Date();
  let previousBalance = 4000; // Starting balance

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(today, i);
    const volatility = 0.15; // 15% maximum change
    const randomChange = (Math.random() * 2 - 1) * volatility;
    const balance = Math.floor(previousBalance * (1 + randomChange));
    
    data.push({
      name: format(date, 'MMM'),
      balance,
      previousBalance,
      date
    });

    previousBalance = balance;
  }

  return data;
};

export const getGrowthRate = (data: ChartDataPoint[]): number => {
  if (data.length < 2) return 0;
  const firstValue = data[0].balance;
  const lastValue = data[data.length - 1].balance;
  return ((lastValue - firstValue) / firstValue) * 100;
};