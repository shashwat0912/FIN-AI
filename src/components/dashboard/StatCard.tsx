import React from 'react';
import { LucideIcon } from 'lucide-react';
import { colors, getStateColor, getStateIcon, layout } from '../../styles/tokens';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  gradient: string;
  bgGradient: string;
  borderColor: string;
}

export default function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  gradient,
  bgGradient,
  borderColor
}: StatCardProps) {
  return (
    <div className={`${colors.surface.base} border ${borderColor} dark:border-dark-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${layout.spacing.card}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-gradient-to-r ${gradient} rounded-lg shadow-sm`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className={`text-sm font-medium ${getStateColor(changeType)} flex items-center space-x-1`}>
          <span className="text-lg">{getStateIcon(changeType)}</span>
          <span>{change}</span>
        </div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <h3 className={`text-2xl font-bold ${colors.text.primary} mb-1`}>{value}</h3>
        <p className={`${colors.text.secondary} text-sm font-medium`}>{title}</p>
      </div>
    </div>
  );
}