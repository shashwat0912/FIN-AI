import React from 'react';
import { formatCurrency } from '../../../utils/chartUtils';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  growthRate: number;
}

export default function ChartTooltip({ active, payload, label, growthRate }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const previousValue = payload[0].payload.previousBalance || 0;
    const monthlyGrowth = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;

    return (
      <div className="glass-morphism p-4 shadow-lg border border-violet-200 animate-fade-in">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-lg font-bold bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
          {formatCurrency(value)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {data.date.toLocaleDateString('en-IN', { 
            year: 'numeric',
            month: 'long'
          })}
        </p>
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Monthly Growth:</span>
            <span className={`font-medium ${monthlyGrowth >= 0 
              ? 'text-emerald-500' 
              : 'text-rose-500'}`}>
              {monthlyGrowth >= 0 ? '↗' : '↘'} {Math.abs(monthlyGrowth).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-gray-500">Overall Trend:</span>
            <span className={`font-medium ${growthRate >= 0 
              ? 'text-emerald-500' 
              : 'text-rose-500'}`}>
              {growthRate >= 0 ? '↗' : '↘'} {Math.abs(growthRate).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}