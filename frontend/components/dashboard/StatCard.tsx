import React from 'react';
import { LucideIcon } from 'lucide-react';
import { getStateColor, getStateIcon } from '../../styles/tokens';

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
  variant?: 'primary' | 'secondary';
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

export function StatCard({
  title,
  value,
  change,
  changeType,
  trend,
  lastUpdate,
  color,
  icon: Icon,
  bgGradient: _bgGradient,
  borderColor,
  variant = 'primary'
}: StatCardProps) {
  const resolvedChangeType =
    changeType ??
    (trend === 'down' ? 'negative' : trend === 'up' ? 'positive' : 'neutral');

  const resolvedBorderColor =
    borderColor || (color ? legacyBorderByColor[color] : 'border-gray-200');

  const isPrimary = variant === 'primary';
  const borderClass = borderColor || color ? `border ${resolvedBorderColor}` : 'border-0';
  const cardPadding = isPrimary ? 'p-6 min-h-[164px]' : 'p-4 min-h-[116px]';
  const valueClass = isPrimary
    ? 'text-display font-semibold leading-tight'
    : 'text-heading font-medium leading-tight';
  const labelClass = isPrimary ? 'text-caption text-text-muted' : 'text-caption text-text-secondary';

  return (
    <div
      data-testid="stat-card"
      className={`bg-surface ${borderClass} ${cardPadding} transition-colors duration-200`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`${valueClass} tabular-nums text-text-primary`}>{value}</p>
            <p className={`mt-2 ${labelClass}`}>{title}</p>
          </div>
          <Icon className={`${isPrimary ? 'h-5 w-5' : 'h-4 w-4'} shrink-0 text-text-muted`} />
        </div>

        {change && (
          <p className={`mt-4 text-caption ${getStateColor(resolvedChangeType)}`}>
            <span aria-hidden="true">{getStateIcon(resolvedChangeType)}</span> {change}
          </p>
        )}
        {lastUpdate && (
          <p className="mt-2 text-caption text-text-muted">{lastUpdate}</p>
        )}
      </div>
    </div>
  );
}

export default StatCard;
