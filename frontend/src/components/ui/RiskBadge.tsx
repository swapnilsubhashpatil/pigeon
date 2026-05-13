/** @format */

import { riskColor, riskBg } from '../../lib/formatters';

interface RiskBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ score, showLabel = true, size = 'md' }: RiskBadgeProps) {
  const sizes = { sm: 'text-[10px] px-1.5 py-0.5', md: 'text-xs px-2 py-0.5', lg: 'text-sm px-2.5 py-1' };
  return (
    <div className={`inline-flex items-center rounded-md border font-mono font-bold ${riskBg(score)} ${sizes[size]}`}>
      <span className={riskColor(score)}>{score}</span>
      {showLabel && <span className="text-gray-600 ml-1 text-[10px]">{score >= 70 ? 'CRIT' : score >= 40 ? 'ELEV' : 'LOW'}</span>}
    </div>
  );
}
