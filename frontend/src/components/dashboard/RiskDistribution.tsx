/** @format */

import { useMemo } from 'react';
import { usePigeonStore } from '../../store/usePigeonStore';

export function RiskDistribution() {
  const shipments = usePigeonStore((s) => s.shipments);

  const data = useMemo(() => {
    const all = Array.from(shipments.values());
    const c = all.filter((s) => s.weighted_risk_score >= 70).length;
    const e = all.filter((s) => s.weighted_risk_score >= 40 && s.weighted_risk_score < 70).length;
    const l = all.filter((s) => s.weighted_risk_score < 40).length;
    const total = all.length || 1;
    return [
      { label: 'Critical', count: c, percent: (c / total) * 100, color: '#EF4444', offset: 0 },
      { label: 'Elevated', count: e, percent: (e / total) * 100, color: '#F59E0B', offset: (c / total) * 100 },
      { label: 'Normal', count: l, percent: (l / total) * 100, color: '#10B981', offset: ((c + e) / total) * 100 },
    ];
  }, [shipments]);

  const total = data.reduce((a, b) => a + b.count, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="rounded-xl border border-white/5 bg-bg-elevated p-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Risk Distribution</h3>
      <div className="flex items-center gap-5">
        <div className="relative w-28 h-28 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            {data.map((d) => (
              <circle
                key={d.label}
                cx="50" cy="50" r={radius} fill="none" stroke={d.color} strokeWidth="8"
                strokeDasharray={`${(d.percent / 100) * circumference} ${circumference}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-mono font-bold text-white">{total}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          {data.map((d) => (
            <div key={d.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-400">{d.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold text-white">{d.count}</span>
                <span className="text-[10px] text-gray-600">{d.percent.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
