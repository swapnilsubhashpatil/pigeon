/** @format */

import type { ExpectedLossBreakdown } from './types';

export function riskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-emerald-400';
}

export function riskBg(score: number): string {
  if (score >= 70) return 'bg-red-400/10 border-red-400/20';
  if (score >= 40) return 'bg-amber-400/10 border-amber-400/20';
  return 'bg-emerald-400/10 border-emerald-400/20';
}

export function riskLabel(score: number): string {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'Elevated';
  return 'Low';
}

export function slaRemaining(deadline: string): string {
  const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 0) return 'BREACHED';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

export function slaUrgency(deadline: string): 'critical' | 'high' | 'medium' | 'normal' {
  const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 24) return 'critical';
  if (hours < 48) return 'high';
  if (hours < 72) return 'medium';
  return 'normal';
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function breachColor(probability: number): string {
  if (probability >= 0.7) return 'text-red-400';
  if (probability >= 0.4) return 'text-amber-400';
  return 'text-emerald-400';
}

export function formatBreachProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function slaOutcomeBadge(outcome: 'met' | 'at_risk' | 'missed') {
  switch (outcome) {
    case 'met':
      return { icon: 'Check', color: 'text-emerald-400', label: 'SLA met' };
    case 'at_risk':
      return { icon: 'AlertTriangle', color: 'text-amber-400', label: 'SLA at risk' };
    case 'missed':
      return { icon: 'X', color: 'text-red-400', label: 'SLA missed' };
  }
}

export function formatEtaDelta(hours: number): string {
  if (hours === 0) return 'on schedule';
  if (hours < 0) return `${Math.abs(hours)}h early`;
  return `${hours}h late`;
}

export function lossBreakdownPercents(breakdown: ExpectedLossBreakdown) {
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
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
