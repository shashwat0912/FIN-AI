import React from 'react';
import { TrendingUp, Download } from 'lucide-react';
import { formatCurrency } from '../../../utils/chartUtils';

interface ChartHeaderProps {
  growthRate: number;
  average: number;
}

export default function ChartHeader({ growthRate, average }: ChartHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Balance Overview
        </h3>
        <p className="text-sm text-gray-500 mt-1">6-month performance analysis</p>
      </div>
      <div className="flex items-center space-x-3">
        <div className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 
                      border border-indigo-100 shadow-sm">
          <div className="flex items-center space-x-2">
            <TrendingUp className={`w-4 h-4 ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            <span className={`text-sm font-medium ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {growthRate >= 0 ? '↗' : '↘'} {Math.abs(growthRate).toFixed(1)}%
            </span>
          </div>
        </div>
        <button className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full
                         transition-colors duration-200">
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}