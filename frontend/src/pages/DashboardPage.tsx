/** @format */

import { useState, useEffect, useMemo } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import { StatsBar } from '../components/dashboard/StatsBar';
import { ShipmentLeaderboard } from '../components/dashboard/ShipmentLeaderboard';
import { EventFeed } from '../components/dashboard/EventFeed';
import { PendingApprovals } from '../components/dashboard/PendingApprovals';
import { RiskDistribution } from '../components/dashboard/RiskDistribution';
import { usePigeonStore } from '../store/usePigeonStore';
import { useToastStore } from '../store/useToastStore';
import { useProgressStore } from '../store/useProgressStore';
import { api } from '../lib/api';

type StatusFilter = 'all' | 'in_transit' | 'delayed' | 'at_port' | 'delivered' | 'pending';

export function DashboardPage() {
  const setShipments = usePigeonStore((s) => s.setShipments);
  const addToast = useToastStore((s) => s.addToast);
  const startProgress = useProgressStore((s) => s.startProgress);
  const completeProgress = useProgressStore((s) => s.completeProgress);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [minRiskFilter, setMinRiskFilter] = useState<number | null>(null);

  useEffect(() => {
    api.shipments().then((data) => { setShipments(data); setLoading(false); }).catch(() => setLoading(false));
  }, [setShipments]);

  const activeFilters = useMemo(() => {
    const f = [];
    if (statusFilter !== 'all') f.push({ label: statusFilter.replace('_', ' '), onRemove: () => setStatusFilter('all') });
    if (minRiskFilter != null) f.push({ label: `Risk ≥ ${minRiskFilter}`, onRemove: () => setMinRiskFilter(null) });
    if (searchQuery) f.push({ label: `"${searchQuery}"`, onRemove: () => setSearchQuery('') });
    return f;
  }, [statusFilter, minRiskFilter, searchQuery]);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-96 bg-white/5 rounded-xl animate-pulse" />
          <div className="space-y-6">
            <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time supply chain monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => { startProgress('Global scan initiated...'); try { await api.refreshRisk(); const data = await api.shipments(); setShipments(data); addToast({ message: 'Global scan complete', type: 'success' }); } catch { addToast({ message: 'Scan failed', type: 'error' }); } finally { completeProgress(); } }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Global Scan
          </button>
        </div>
      </div>

      <StatsBar />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input type="text" placeholder="Search shipments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/5 bg-bg-elevated text-sm text-gray-200 placeholder-gray-700 outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"><X className="w-4 h-4" /></button>}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="px-4 py-2.5 rounded-xl border border-white/5 bg-bg-elevated text-sm text-gray-400 outline-none focus:border-indigo-500/30 appearance-none cursor-pointer">
          <option value="all">All Statuses</option><option value="in_transit">In Transit</option><option value="delayed">Delayed</option><option value="at_port">At Port</option><option value="pending">Pending</option><option value="delivered">Delivered</option>
        </select>
        <select value={minRiskFilter ?? ''} onChange={(e) => setMinRiskFilter(e.target.value ? Number(e.target.value) : null)} className="px-4 py-2.5 rounded-xl border border-white/5 bg-bg-elevated text-sm text-gray-400 outline-none focus:border-indigo-500/30 appearance-none cursor-pointer">
          <option value="">All Risk</option><option value="70">Critical (≥70)</option><option value="40">Elevated (≥40)</option>
        </select>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2">
          {activeFilters.map((f, i) => <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">{f.label}<button onClick={f.onRemove} className="hover:text-indigo-300"><X className="w-3 h-3" /></button></span>)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <ShipmentLeaderboard searchQuery={searchQuery} statusFilter={statusFilter} minRiskFilter={minRiskFilter} />
        </div>
        <div className="space-y-6">
          <RiskDistribution />
          <div className="rounded-xl border border-white/5 bg-bg-elevated p-5"><PendingApprovals /></div>
          <div className="rounded-xl border border-white/5 bg-bg-elevated p-5 min-h-[280px]"><EventFeed /></div>
        </div>
      </div>
    </div>
  );
}
