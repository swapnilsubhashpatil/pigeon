/** @format */

export function riskColor(score: number): string {
  if (score >= 70) return 'text-red-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-emerald-500';
}

export function riskBg(score: number): string {
  if (score >= 70) return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (score >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
}

export function riskGlow(score: number): string {
  if (score >= 70) return 'glow-red';
  if (score >= 40) return 'glow-amber';
  return 'glow-emerald';
}

export function riskLabel(score: number): string {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'Elevated';
  return 'Normal';
}

export function slaRemaining(deadline: string): string {
  const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 0) return 'BREACHED';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function breachColor(probability: number): string {
  if (probability >= 0.7) return 'text-red-500';
  if (probability >= 0.4) return 'text-amber-500';
  return 'text-emerald-500';
}

export function formatBreachProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function slaOutcomeBadge(outcome: 'met' | 'at_risk' | 'missed') {
  switch (outcome) {
    case 'met': return { icon: 'Check', color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'SLA met' };
    case 'at_risk': return { icon: 'AlertTriangle', color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'SLA at risk' };
    case 'missed': return { icon: 'X', color: 'text-red-400', bg: 'bg-red-500/10', label: 'SLA missed' };
  }
}

export function formatEtaDelta(hours: number): string {
  if (hours === 0) return 'on schedule';
  if (hours < 0) return `${Math.abs(hours)}h early`;
  return `${hours}h late`;
}

export function lossBreakdownPercents(breakdown: { direct_cost: number; sla_penalty: number; cascade_exposure: number }) {
  const total = breakdown.direct_cost + breakdown.sla_penalty + breakdown.cascade_exposure;
  if (total === 0) return { direct: 0, penalty: 0, cascade: 0 };
  return {
    direct: (breakdown.direct_cost / total) * 100,
    penalty: (breakdown.sla_penalty / total) * 100,
    cascade: (breakdown.cascade_exposure / total) * 100,
  };
}

export function rankColor(allLosses: number[], thisLoss: number): string {
  const min = Math.min(...allLosses);
  const max = Math.max(...allLosses);
  if (thisLoss === min) return 'text-emerald-400';
  if (thisLoss === max) return 'text-red-400';
  return 'text-amber-400';
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
