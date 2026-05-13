/** @format */

import { useState, useEffect } from 'react';
import { GitPullRequest, ArrowRight, CheckCircle2, Zap, XCircle, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { usePigeonStore } from '../store/usePigeonStore';
import { useToastStore } from '../store/useToastStore';
import { DecisionCard } from '../components/decision/DecisionCard';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/ui/Loading';
import { ExportButton } from '../components/ui/ExportButton';
import { formatUSD, formatRelativeTime } from '../lib/formatters';
import type { DecisionRecord } from '../lib/types';

function PendingRow({ decision }: { decision: DecisionRecord }) {
  const shipments = usePigeonStore((s) => s.shipments);
  const addToast = useToastStore((s) => s.addToast);
  const shipment = shipments.get(decision.shipment_id);
  const recommended = decision.options[0];
  const [expanded, setExpanded] = useState(false);

  async function handleApproveRecommended() {
    if (!recommended) return;
    try {
      await api.approveDecision(decision.decision_id, recommended.option_id);
      usePigeonStore.getState().resolveDecision(decision.decision_id, 'approved');
      usePigeonStore.getState().pushFeedItem({ id: `approved-${decision.decision_id}`, type: 'approved', message: `Approved ${decision.decision_id}`, timestamp: +new Date() });
      addToast({ message: `Approved ${decision.decision_id}`, type: 'success' });
    } catch { addToast({ message: 'Failed to approve', type: 'error' }); }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-bg-elevated overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-600">{decision.decision_id}</span>
            <span className="text-sm font-mono font-bold text-white">{decision.shipment_id}</span>
          </div>
          {shipment && <span className="text-sm text-gray-500">{shipment.origin.port} → {shipment.destination.port}</span>}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">Risk:</span>
            <span className={`text-sm font-mono font-bold ${(shipment?.weighted_risk_score ?? 0) >= 70 ? 'text-red-400' : (shipment?.weighted_risk_score ?? 0) >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>{shipment?.weighted_risk_score ?? '-'}</span>
          </div>
          {recommended && <div className="flex items-center gap-2 text-sm text-gray-400"><span className="text-emerald-400 font-bold">{recommended.label}</span><span className="text-gray-600">({formatUSD(recommended.expected_loss_usd ?? recommended.cost_delta_usd)})</span></div>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={handleApproveRecommended}>Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Review'}<ArrowRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} /></Button>
        </div>
      </div>
      {expanded && <div className="px-5 pb-5 border-t border-white/5 pt-5"><DecisionCard decision={decision} /></div>}
    </div>
  );
}

function AuditRow({ decision }: { decision: DecisionRecord }) {
  const shipments = usePigeonStore((s) => s.shipments);
  const shipment = shipments.get(decision.shipment_id);
  const config = {
    auto_executed: { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Auto' },
    approved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Approved' },
    overridden: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Rejected' },
    pending_approval: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending' },
  }[decision.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-white/[0.02] transition-colors rounded-lg">
      <div className="flex items-center gap-5">
        <span className="text-[10px] font-mono text-gray-600 w-24">{decision.decision_id}</span>
        <span className="text-sm font-mono font-bold text-white w-24">{decision.shipment_id}</span>
        {shipment && <span className="text-sm text-gray-500">{shipment.origin.port} → {shipment.destination.port}</span>}
      </div>
      <div className="flex items-center gap-5">
        <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${config.color} ${config.bg}`}><Icon className="w-3.5 h-3.5" />{config.label}</span>
        {decision.selected_option_id && <span className="text-[10px] font-mono text-gray-600">{decision.selected_option_id}</span>}
        {decision.resolved_at && <span className="text-xs text-gray-600">{formatRelativeTime(decision.resolved_at)}</span>}
      </div>
    </div>
  );
}

export function DecisionsPage() {
  const pending = usePigeonStore((s) => s.pendingDecisions);
  const auditLog = usePigeonStore((s) => s.auditLog);
  const setAuditLog = usePigeonStore((s) => s.setAuditLog);
  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.pendingDecisions(), api.auditLog()])
      .then(([pendingData, auditData]) => {
        const store = usePigeonStore.getState();
        pendingData.forEach((d) => store.addDecision(d));
        setAuditLog(auditData);
        setLoading(false);
      })
      .catch((err) => { addToast({ message: err.message || 'Failed', type: 'error' }); setLoading(false); });
  }, [setAuditLog, addToast]);

  if (loading) return <Loading text="Loading decisions..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Decision Queue</h1>
        <p className="text-sm text-gray-500 mt-1">{pending.length} pending · {auditLog.length} resolved</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><GitPullRequest className="w-4 h-4 text-indigo-400" />Pending ({pending.length})</h2>
        {pending.length === 0 ? <div className="text-center py-10 text-gray-600 text-sm border border-dashed border-white/5 rounded-xl">All caught up</div> : <div className="space-y-3">{pending.map((d) => <PendingRow key={d.decision_id} decision={d} />)}</div>}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />Resolved ({auditLog.length})</h2>
          <ExportButton data={auditLog} filename="decisions-audit-log" label="Export CSV" />
        </div>
        {auditLog.length === 0 ? <div className="text-center py-10 text-gray-600 text-sm border border-dashed border-white/5 rounded-xl">No resolved decisions</div> : <div className="rounded-xl border border-white/5 bg-bg-elevated divide-y divide-white/5">{auditLog.map((d) => <AuditRow key={`${d.decision_id}-${d.resolved_at}`} decision={d} />)}</div>}
      </div>
    </div>
  );
}
