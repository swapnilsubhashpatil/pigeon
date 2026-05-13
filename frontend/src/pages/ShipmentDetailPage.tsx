/** @format */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Anchor, Ship, Truck, Train, Plane, Package, AlertTriangle, Zap } from 'lucide-react';
import { Loading } from '../components/ui/Loading';
import { DecisionCardSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../store/useToastStore';
import { api } from '../lib/api';
import { RiskBadge } from '../components/ui/RiskBadge';
import { Button } from '../components/ui/Button';
import { CopyButton } from '../components/ui/CopyButton';
import { getRouteDisplay } from '../lib/constants';
import { slaRemaining, riskColor } from '../lib/formatters';
import type { Shipment, Leg, CascadeImpactReport, DecisionRecord } from '../lib/types';
import { DecisionCard } from '../components/decision/DecisionCard';
import { ShipmentTimeline } from '../components/shipment/ShipmentTimeline';
import { NetworkGraph } from '../components/shipment/NetworkGraph';

const LEG_ICONS: Record<string, React.ElementType> = {
  trucking: Truck, ocean: Ship, port: Anchor, rail: Train, air: Plane, 'last-mile': Package,
};

function LegBreakdown({ legs }: { legs: Leg[] }) {
  return (
    <div className="space-y-3">
      {legs.map((leg) => {
        const Icon = LEG_ICONS[leg.type] ?? Truck;
        const isCritical = leg.risk_score >= 70;
        return (
          <div key={leg.leg_id} className="flex items-center gap-4 group">
            <div className="w-28 flex items-center gap-2 shrink-0">
              <Icon className="w-4 h-4 text-gray-600" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{leg.leg_id}</span>
              <span className="text-[10px] text-gray-600 capitalize">{leg.type}</span>
            </div>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${leg.risk_score >= 70 ? 'bg-red-500' : leg.risk_score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${leg.risk_score}%` }} />
            </div>
            <span className={`w-10 text-right text-sm font-mono font-bold ${riskColor(leg.risk_score)}`}>{leg.risk_score}</span>
            {isCritical && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />}
          </div>
        );
      })}
    </div>
  );
}

function CascadeSection({ shipment }: { shipment: Shipment }) {
  const [report, setReport] = useState<CascadeImpactReport | null>(null);
  const [delayHours, setDelayHours] = useState(18);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.simulateCascade(shipment.shipment_id, delayHours).then(setReport).finally(() => setLoading(false));
  }, [shipment.shipment_id, delayHours]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cascade Simulation</h3>
        <select value={delayHours} onChange={(e) => setDelayHours(Number(e.target.value))} className="bg-bg-elevated border border-white/5 rounded-lg text-xs text-gray-400 px-3 py-1.5 outline-none focus:border-indigo-500/30">
          {[6, 12, 18, 24, 48].map((h) => <option key={h} value={h}>{h}h delay</option>)}
        </select>
      </div>
      {loading ? <div className="flex items-center justify-center py-8"><RefreshCw className="w-5 h-5 text-gray-600 animate-spin" /></div> : report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[{ l: 'Affected', v: `${report.affected_shipments.length}` }, { l: 'POs', v: `${report.affected_purchase_orders.length}` }, { l: 'Customers', v: `${report.affected_customers.length}` }, { l: 'Exposure', v: `$${report.total_sla_exposure_usd.toLocaleString()}`, c: 'text-red-400' }].map((s) => (
              <div key={s.l} className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{s.l}</div>
                <div className={`text-lg font-mono font-bold ${s.c || 'text-white'}`}>{s.v}</div>
              </div>
            ))}
          </div>
          {report.cascade_nodes.length > 0 && (
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <table className="w-full text-left"><thead className="bg-white/[0.02]"><tr className="border-b border-white/5 text-[10px] uppercase text-gray-600"><th className="px-3 py-2">Shipment</th><th className="px-3 py-2">Hop</th><th className="px-3 py-2">Delay</th><th className="px-3 py-2">SLA</th><th className="px-3 py-2 text-right">Exposure</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {report.cascade_nodes.map((node) => (
                    <tr key={node.shipment_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs font-mono font-bold text-gray-300">{node.shipment_id}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{node.hop_depth}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-gray-400">{node.delay_hours}h</td>
                      <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${node.sla_breached ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{node.sla_breached ? 'Breached' : 'OK'}</span></td>
                      <td className="px-3 py-2.5 text-xs font-mono text-gray-400 text-right">${node.sla_exposure_usd.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : <div className="text-xs text-gray-600 py-6">No cascade data.</div>}
    </div>
  );
}

export function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (!id) return; api.shipment(id).then(setShipment).catch(() => {}).finally(() => setLoading(false)); }, [id]);

  async function handleRefresh() {
    if (!id) return; setRefreshing(true);
    try { const updated = await api.refreshRisk(id); setShipment(updated); addToast({ message: 'Risk refreshed', type: 'success' }); } catch { addToast({ message: 'Refresh failed', type: 'error' }); } finally { setRefreshing(false); }
  }

  async function handleGenerateDecision() {
    if (!id) return; setGenerating(true);
    try { const record = await api.generateDecision(id); setDecision(record); addToast({ message: record.status === 'auto_executed' ? 'Auto-executed' : 'Decision generated', type: 'success' }); } catch { addToast({ message: 'Generation failed', type: 'error' }); } finally { setGenerating(false); }
  }

  if (loading) return <Loading text="Loading shipment..." />;
  if (!shipment) return <div className="h-full flex items-center justify-center"><div className="text-center"><p className="text-gray-600 text-sm">Shipment not found</p><Button variant="ghost" onClick={() => navigate('/')} className="mt-4"><ArrowLeft className="w-4 h-4" />Back</Button></div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-300 transition-colors"><ArrowLeft className="w-4 h-4" />Back</button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{shipment.shipment_id}</h1>
              <CopyButton text={shipment.shipment_id} />
              <RiskBadge score={shipment.weighted_risk_score} size="md" />
            </div>
            <p className="text-sm text-gray-500 mt-1">{shipment.carrier} · {getRouteDisplay(shipment)} · SLA: {new Date(shipment.SLA_deadline).toLocaleDateString()} ({slaRemaining(shipment.SLA_deadline)})</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh Risk</Button>
      </div>

      {/* Giant Risk Score */}
      <div className="rounded-2xl border border-white/5 bg-bg-elevated p-8 text-center relative overflow-hidden">
        <div className={`absolute inset-0 opacity-10 ${shipment.weighted_risk_score >= 70 ? 'bg-red-500' : shipment.weighted_risk_score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <div className="relative">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2">Weighted Risk Score</div>
          <div className={`text-7xl font-mono font-bold tracking-tighter ${riskColor(shipment.weighted_risk_score)}`}>{shipment.weighted_risk_score}</div>
          <div className="text-xs text-gray-600 mt-2">Composite {shipment.composite_risk_score} · Multiplier {shipment.sla_urgency_multiplier}x</div>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-6">
          <div className={`h-full rounded-full transition-all duration-1000 ${shipment.weighted_risk_score >= 70 ? 'bg-red-500' : shipment.weighted_risk_score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${shipment.weighted_risk_score}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/5 bg-bg-elevated p-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">Leg Breakdown</h3>
          <LegBreakdown legs={shipment.legs} />
        </div>
        <div className="rounded-xl border border-white/5 bg-bg-elevated p-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">Journey Timeline</h3>
          <ShipmentTimeline shipment={shipment} />
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-bg-elevated p-6">
        <CascadeSection shipment={shipment} />
      </div>

      <div className="rounded-xl border border-white/5 bg-bg-elevated p-6">
        <NetworkGraph shipmentId={shipment.shipment_id} />
      </div>

      <div className="rounded-xl border border-white/5 bg-bg-elevated p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Decision Engine</h3>
            <p className="text-[11px] text-gray-600 mt-0.5">AI-powered reroute recommendations</p>
          </div>
          {!decision && !generating && <Button variant="primary" onClick={handleGenerateDecision}><Zap className="w-4 h-4" />Generate Options</Button>}
        </div>
        {generating && <DecisionCardSkeleton />}
        {decision && !generating && <DecisionCard decision={decision} onUpdate={setDecision} />}
      </div>
    </div>
  );
}
