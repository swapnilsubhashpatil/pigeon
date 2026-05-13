import { store } from '@/store';
import type { CascadeImpactReport } from '@/types';
import { simulateCascade } from './exposure';

export { simulateCascade } from './exposure';

export function getCascadeGraph(): Record<string, string[]> {
  const graph = store.getGraph();
  const result: Record<string, string[]> = {};
  for (const [from, tos] of graph.entries()) {
    result[from] = tos;
  }
  return result;
}

// Called by store when a disruption is added — runs BFS and broadcasts the report.
export function handleDisruptionEvent(
  affectedLanes: string[],
  estimatedDelayHours: number
): CascadeImpactReport[] {
  const reports: CascadeImpactReport[] = [];

  // Find shipments on the affected lanes and simulate each
  const shipments = store.getAll().filter((s) => {
    const lane = `${s.origin.port}-${s.destination.port}`;
    return affectedLanes.includes(lane);
  });

  const seen = new Set<string>();
  for (const shipment of shipments) {
    if (seen.has(shipment.shipment_id)) continue;
    seen.add(shipment.shipment_id);

    const report = simulateCascade(shipment.shipment_id, estimatedDelayHours);
    if (report.affected_shipments.length > 0) {
      reports.push(report);
      store.broadcast({ type: 'cascade_report', report });
    }
  }

  return reports;
}
