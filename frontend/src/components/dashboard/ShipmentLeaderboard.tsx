/** @format */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';
import { RiskBadge } from '../ui/RiskBadge';
import { LegSparkline } from '../ui/LegSparkline';
import { slaRemaining } from '../../lib/formatters';
import { getRouteDisplay } from '../../lib/constants';

export function ShipmentLeaderboard({ searchQuery = '', statusFilter = 'all', minRiskFilter }: {
  searchQuery?: string;
  statusFilter?: string;
  minRiskFilter?: number | null;
}) {
  const shipments = usePigeonStore((s) => s.shipments);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let arr = Array.from(shipments.values());
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((s) =>
        s.shipment_id.toLowerCase().includes(q) ||
        s.carrier.toLowerCase().includes(q) ||
        s.origin.port.toLowerCase().includes(q) ||
        s.destination.port.toLowerCase().includes(q) ||
        getRouteDisplay(s).toLowerCase().includes(q)
      );
    }
    if (statusFilter && statusFilter !== 'all') arr = arr.filter((s) => s.status === statusFilter);
    if (minRiskFilter != null) arr = arr.filter((s) => s.weighted_risk_score >= minRiskFilter);
    return arr.sort((a, b) => b.weighted_risk_score - a.weighted_risk_score);
  }, [shipments, searchQuery, statusFilter, minRiskFilter]);

  return (
    <div className="rounded-xl border border-white/5 bg-bg-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Shipments</span>
        <span className="text-[10px] font-mono text-gray-600">{filtered.length} of {shipments.size}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-gray-600">
              <th className="px-4 py-2.5 font-semibold">Shipment</th>
              <th className="px-4 py-2.5 font-semibold">Risk</th>
              <th className="px-4 py-2.5 font-semibold">Route</th>
              <th className="px-4 py-2.5 font-semibold">Carrier</th>
              <th className="px-4 py-2.5 font-semibold">SLA</th>
              <th className="px-4 py-2.5 font-semibold">Legs</th>
              <th className="px-4 py-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-600">No shipments match filters</td></tr>
            )}
            {filtered.map((s) => (
              <tr
                key={s.shipment_id}
                onClick={() => navigate(`/shipments/${s.shipment_id}`)}
                className="group cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-gray-200">{s.shipment_id}</span>
                </td>
                <td className="px-4 py-3"><RiskBadge score={s.weighted_risk_score} size="sm" /></td>
                <td className="px-4 py-3 text-sm text-gray-400">{getRouteDisplay(s)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.carrier}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-mono font-medium ${slaRemaining(s.SLA_deadline) === 'BREACHED' ? 'text-red-400' : 'text-gray-500'}`}>
                    {slaRemaining(s.SLA_deadline)}
                  </span>
                </td>
                <td className="px-4 py-3"><LegSparkline legs={s.legs} /></td>
                <td className="px-4 py-3">
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-indigo-400 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
