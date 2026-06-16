import React from 'react';
import { LucideIcon } from 'lucide-react';
import { colors, getStateColor, getStateIcon, layout } from '../../styles/tokens';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  trend?: 'up' | 'down';
  lastUpdate?: string;
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'orange' | 'teal';
  icon: LucideIcon;
  gradient?: string;
  bgGradient?: string;
  borderColor?: string;
}

const legacyBorderByColor: Record<NonNullable<StatCardProps['color']>, string> = {
  blue: 'border-blue-200',
  green: 'border-green-200',
  purple: 'border-purple-200',
  yellow: 'border-yellow-200',
  red: 'border-red-200',
  orange: 'border-orange-200',
  teal: 'border-teal-200',
};

const legacyGradientByColor: Record<NonNullable<StatCardProps['color']>, string> = {
  blue: 'from-blue-500 to-cyan-500',
  green: 'from-green-500 to-emerald-500',
  purple: 'from-purple-500 to-violet-500',
  yellow: 'from-yellow-500 to-amber-500',
  red: 'from-red-500 to-pink-500',
  orange: 'from-orange-500 to-yellow-500',
  teal: 'from-teal-500 to-green-500',
};

export function StatCard({
  title,
  value,
  change,
  changeType,
  trend,
  lastUpdate,
  color,
  icon: Icon,
  gradient,
  bgGradient: _bgGradient,
  borderColor
}: StatCardProps) {
  const resolvedChangeType =
    changeType ??
    (trend === 'down' ? 'negative' : trend === 'up' ? 'positive' : 'neutral');

  const resolvedGradient =
    gradient || (color ? legacyGradientByColor[color] : 'from-gray-500 to-gray-600');

  const resolvedBorderColor =
    borderColor || (color ? legacyBorderByColor[color] : 'border-gray-200');

  return (
    <div
      data-testid="stat-card"
      className={`${colors.surface.base} border ${resolvedBorderColor} dark:border-dark-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${layout.spacing.card}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-gradient-to-r ${resolvedGradient} rounded-lg shadow-sm`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {change && (
          <div className="text-sm font-medium flex items-center space-x-1">
            <span className="text-lg">{getStateIcon(resolvedChangeType)}</span>
            <span className={getStateColor(resolvedChangeType)}>{change}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-2">
        <h3 className={`text-2xl font-bold ${colors.text.primary} mb-1`}>{value}</h3>
        <p className={`${colors.text.secondary} text-sm font-medium`}>{title}</p>
        {lastUpdate && (
          <p className={`${colors.text.tertiary} text-xs mt-1`}>{lastUpdate}</p>
        )}
      </div>
    </div>
  );
}

export default StatCard;
