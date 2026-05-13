/** @format */

import { AlertTriangle, Clock, CheckCircle, Zap, DollarSign } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';
import { formatUSD } from '../../lib/formatters';

export function StatsBar() {
  const shipments = usePigeonStore((s) => s.shipments);
  const disruptions = usePigeonStore((s) => s.disruptions);

  const all = Array.from(shipments.values());
  const critical = all.filter((s) => s.weighted_risk_score >= 70).length;
  const elevated = all.filter((s) => s.weighted_risk_score >= 40 && s.weighted_risk_score < 70).length;
  const low = all.filter((s) => s.weighted_risk_score < 40).length;
  const totalExposure = all.filter((s) => s.weighted_risk_score >= 70).reduce((sum) => sum + 50000, 0);

  const stats = [
    { label: 'Critical', value: critical, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/10' },
    { label: 'Elevated', value: elevated, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/10' },
    { label: 'Normal', value: low, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/10' },
    { label: 'Disruptions', value: disruptions.length, icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/5 border-cyan-500/10' },
    { label: 'Exposure', value: formatUSD(totalExposure), icon: DollarSign, color: 'text-gray-200', bg: 'bg-white/5 border-white/10' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className={`flex flex-col p-4 rounded-xl border ${stat.bg} backdrop-blur-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{stat.label}</span>
            </div>
            <span className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        );
      })}
    </div>
  );
}
