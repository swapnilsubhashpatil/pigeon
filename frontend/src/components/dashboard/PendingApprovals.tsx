/** @format */

import { useNavigate } from 'react-router-dom';
import { GitPullRequest, ArrowRight } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';

export function PendingApprovals() {
  const pending = usePigeonStore((s) => s.pendingDecisions);
  const shipments = usePigeonStore((s) => s.shipments);
  const resolveDecision = usePigeonStore((s) => s.resolveDecision);
  const pushFeedItem = usePigeonStore((s) => s.pushFeedItem);
  const navigate = useNavigate();

  async function handleApprove(decisionId: string, optionId: string) {
    try {
      await api.approveDecision(decisionId, optionId);
      resolveDecision(decisionId, 'approved');
      pushFeedItem({ id: `approved-${decisionId}`, type: 'approved', message: `Approved ${decisionId}`, timestamp: +new Date() });
    } catch {
      // toast handled elsewhere
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <GitPullRequest className="w-3.5 h-3.5 text-indigo-400" />
          Pending ({pending.length})
        </h3>
      </div>
      {pending.length === 0 ? (
        <div className="text-center py-6 text-gray-700 text-xs border border-dashed border-white/5 rounded-lg">All clear</div>
      ) : (
        <div className="space-y-2">
          {pending.slice(0, 4).map((decision) => {
            const shipment = shipments.get(decision.shipment_id);
            const rec = decision.options[0];
            return (
              <div key={decision.decision_id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-600">{decision.decision_id}</span>
                    <span className="text-xs font-mono text-gray-300">{decision.shipment_id}</span>
                  </div>
                  {shipment && <span className="text-[10px] text-gray-600">{shipment.origin.port} → {shipment.destination.port}</span>}
                </div>
                {rec && <div className="mb-2 text-[11px] text-gray-500">Rec: <span className="text-emerald-400 font-semibold">{rec.label}</span> <span className="text-gray-600">(+${rec.cost_delta_usd.toLocaleString()})</span></div>}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="primary" onClick={() => rec && handleApprove(decision.decision_id, rec.option_id)}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/shipments/${decision.shipment_id}`)}>Review <ArrowRight className="w-3 h-3" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
