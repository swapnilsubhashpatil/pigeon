/** @format */

import { riskColor, riskBg, riskLabel } from '../../lib/formatters';

interface RiskBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ score, showLabel = true, size = 'md' }: RiskBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const scoreSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-base',
  };

  return (
    <div className={`inline-flex items-center rounded-sm border font-mono font-medium ${riskBg(score)} ${sizeClasses[size]}`}>
      <span className={riskColor(score)}>{score}</span>
      {showLabel && (
        <span className={`text-slate-500 ${scoreSize[size]}`}>{riskLabel(score)}</span>
      )}
    </div>
  );
}
