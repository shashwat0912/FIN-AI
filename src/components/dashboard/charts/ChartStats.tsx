import React from 'react';
import { formatCurrency } from '../../../utils/chartUtils';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface ChartStatsProps {
  average: number;
  highest: number;
  growthRate: number;
}

export default function ChartStats({ average, highest, growthRate }: ChartStatsProps) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-indigo-100">
          <div className="flex items-center justify-center mb-1">
            <Activity className="w-4 h-4 text-indigo-600 mr-1" />
            <p className="text-sm text-gray-600">Average</p>
          </div>
          <p className="text-lg font-semibold text-indigo-600">
            {formatCurrency(average)}
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-gradient-to-r from-green-50 to-green-100">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <p className="text-sm text-gray-600">Highest</p>
          </div>
          <p className="text-lg font-semibold text-green-600">
            {formatCurrency(highest)}
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100">
          <div className="flex items-center justify-center mb-1">
            {growthRate >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
            )}
            <p className="text-sm text-gray-600">Trend</p>
          </div>
          <p className={`text-lg font-semibold ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {growthRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}