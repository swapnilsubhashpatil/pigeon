/** @format */

import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, RefreshCw, LayoutGrid, Table2 } from 'lucide-react';
import { StatsBar } from '../components/dashboard/StatsBar';
import { ShipmentLeaderboard } from '../components/dashboard/ShipmentLeaderboard';
import { ShipmentGrid } from '../components/dashboard/ShipmentGrid';
import { EventFeed } from '../components/dashboard/EventFeed';
import { PendingApprovals } from '../components/dashboard/PendingApprovals';
import { RiskDistribution } from '../components/dashboard/RiskDistribution';
import { StatsBarSkeleton, ShipmentRowSkeleton } from '../components/ui/Skeleton';
import { usePigeonStore } from '../store/usePigeonStore';
import { useToastStore } from '../store/useToastStore';
import { useProgressStore } from '../store/useProgressStore';
import { api } from '../lib/api';

type ViewMode = 'table' | 'grid';
type StatusFilter = 'all' | 'in_transit' | 'delayed' | 'at_port' | 'delivered' | 'pending';

export function DashboardPage() {
  const setShipments = usePigeonStore((s) => s.setShipments);
  const addToast = useToastStore((s) => s.addToast);
  const startProgress = useProgressStore((s) => s.startProgress);
  const completeProgress = useProgressStore((s) => s.completeProgress);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 1024 ? 'grid' : 'table';
    }
    return 'table';
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [minRiskFilter, setMinRiskFilter] = useState<number | null>(null);

  useEffect(() => {
    api.shipments()
      .then((data) => {
        setShipments(data);
        setLoading(false);
      })
      .catch((err) => {
        addToast({ message: err.message || 'Failed to load shipments', type: 'error' });
        setLoading(false);
      });
  }, [setShipments, addToast]);

  const activeFilters = useMemo(() => {
    const filters = [];
    if (statusFilter !== 'all') filters.push({ label: statusFilter.replace('_', ' '), onRemove: () => setStatusFilter('all') });
    if (minRiskFilter !== null) filters.push({ label: `Risk ≥ ${minRiskFilter}`, onRemove: () => setMinRiskFilter(null) });
    if (searchQuery) filters.push({ label: `Search: "${searchQuery}"`, onRemove: () => setSearchQuery('') });
    return filters;
  }, [statusFilter, minRiskFilter, searchQuery]);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <StatsBarSkeleton />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <table className="w-full">
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <ShipmentRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time supply chain monitoring and risk assessment</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Table2 className="w-4 h-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </button>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              api.shipments()
                .then((data) => {
                  setShipments(data);
                  addToast({ message: 'Shipments refreshed', type: 'success' });
                })
                .catch(() => addToast({ message: 'Failed to refresh', type: 'error' }))
                .finally(() => setLoading(false));
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={async () => {
              startProgress('Refreshing all shipment risk scores...');
              try {
                await api.refreshRisk();
                const data = await api.shipments();
                setShipments(data);
                addToast({ message: 'All risk scores refreshed', type: 'success' });
              } catch {
                addToast({ message: 'Failed to refresh risk scores', type: 'error' });
              } finally {
                completeProgress();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh All
          </button>
        </div>
      </div>

      <StatsBar />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shipments by ID, carrier, or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="in_transit">In Transit</option>
            <option value="delayed">Delayed</option>
            <option value="at_port">At Port</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        <div className="relative">
          <select
            value={minRiskFilter ?? ''}
            onChange={(e) => setMinRiskFilter(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
          >
            <option value="">All Risk Levels</option>
            <option value="70">Critical (≥70)</option>
            <option value="40">Elevated (≥40)</option>
            <option value="0">Low (≥0)</option>
          </select>
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2">
          {activeFilters.map((filter, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
            >
              {filter.label}
              <button onClick={filter.onRemove} className="hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Shipments — 2/3 */}
        <div className="col-span-2">
          {viewMode === 'table' ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <ShipmentLeaderboard
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                minRiskFilter={minRiskFilter}
              />
            </div>
          ) : (
            <ShipmentGrid
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              minRiskFilter={minRiskFilter}
            />
          )}
        </div>

        {/* Right sidebar — 1/3 */}
        <div className="space-y-6">
          <RiskDistribution />
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <PendingApprovals />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 min-h-[300px]">
            <EventFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}
