import React, { useState, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Legend, Area, AreaChart
} from 'recharts';
import { formatCurrency, generateChartData, getGrowthRate } from '../../utils/chartUtils';
import ChartHeader from './charts/ChartHeader';
import ChartTooltip from './charts/ChartTooltip';
import ChartStats from './charts/ChartStats';
import { Calendar, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export default function BalanceChart() {
  const [timeRange, setTimeRange] = useState(6);
  const [data, setData] = useState(() => generateChartData(timeRange));
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const growthRate = getGrowthRate(data);
  const average = data.reduce((acc, curr) => acc + curr.balance, 0) / data.length;
  const highest = Math.max(...data.map(d => d.balance));

  const handleTimeRangeChange = (months: number) => {
    setTimeRange(months);
    setData(generateChartData(months));
  };

  const refreshData = useCallback(() => {
    setData(generateChartData(timeRange));
  }, [timeRange]);

  return (
    <div className="p-6">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Balance Overview</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Track your financial growth over time</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
            {[3, 6, 12].map((months) => (
              <button
                key={months}
                onClick={() => handleTimeRangeChange(months)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 
                          ${timeRange === months 
                            ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                {months}M
              </button>
            ))}
          </div>
          
          <button
            onClick={refreshData}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-all duration-200"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Growth Indicator */}
      <div className="flex items-center space-x-4 mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-dark-800 dark:to-dark-900 rounded-xl border border-gray-200 dark:border-dark-700">
        <div className="flex items-center space-x-2">
          {growthRate >= 0 ? (
            <TrendingUp className="w-5 h-5 text-green-600" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-600" />
          )}
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Growth Rate</span>
        </div>
        <span className={`text-lg font-bold ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
        </span>
        <div className="flex-1 h-px bg-gray-300 dark:bg-dark-700"></div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">₹{Math.max(...data.map(d => d.balance)).toLocaleString()}</p>
        </div>
      </div>

      {/* Chart Container */}
      <div className={`${isMobile ? 'h-[300px]' : 'h-[400px]'} mb-6`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data} 
            margin={{ 
              top: 20, 
              right: 30, 
              left: 20, 
              bottom: 20 
            }}
          >
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6"/>
                <stop offset="100%" stopColor="#3B82F6"/>
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#E5E7EB" 
              opacity={0.5}
              vertical={false}
            />
            
            <XAxis 
              dataKey="name" 
              stroke="#9CA3AF"
              tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
              tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
            />
            
            <Tooltip 
              content={<ChartTooltip growthRate={growthRate} />}
              cursor={{
                stroke: '#8B5CF6',
                strokeWidth: 2,
                strokeDasharray: '5 5'
              }}
            />
            
            <ReferenceLine 
              y={average} 
              stroke="#A78BFA"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ 
                value: 'Average',
                fill: '#7C3AED',
                fontSize: 12,
                fontWeight: 600,
                position: 'insideTopRight'
              }}
            />
            
            <Area
              type="monotone"
              dataKey="balance"
              stroke="url(#lineGradient)"
              strokeWidth={3}
              fill="url(#balanceGradient)"
              dot={{
                fill: '#8B5CF6',
                stroke: '#FFFFFF',
                strokeWidth: 2,
                r: 4
              }}
              activeDot={{
                r: 6,
                fill: '#8B5CF6',
                stroke: '#FFFFFF',
                strokeWidth: 3
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Average Balance</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">₹{(average/1000).toFixed(0)}k</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Highest Balance</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">₹{(highest/1000).toFixed(0)}k</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Time Period</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{timeRange} Months</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}