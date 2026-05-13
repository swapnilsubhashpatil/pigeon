import { store } from '@/store';
import type { CascadeNode } from '@/types';

const MAX_HOPS = 5;
const DELAY_ATTENUATION = 0.85;

interface BfsQueueItem {
  shipmentId: string;
  delayHours: number;
  depth: number;
  pathFromTrigger: string[];
}

export interface TraversalResult {
  nodes: CascadeNode[];
  nodePathMap: Map<string, string[]>; // shipmentId → path from trigger
}

export function traverseGraph(triggerShipmentId: string, triggerDelayHours: number): TraversalResult {
  const visited = new Set<string>([triggerShipmentId]);
  const queue: BfsQueueItem[] = [];
  const nodes: CascadeNode[] = [];
  const nodePathMap = new Map<string, string[]>();

  // Seed queue with direct dependents of the trigger (hop 1)
  for (const depId of store.getDependents(triggerShipmentId)) {
    if (!visited.has(depId)) {
      visited.add(depId);
      queue.push({
        shipmentId: depId,
        delayHours: triggerDelayHours,
        depth: 1,
        pathFromTrigger: [triggerShipmentId, depId],
      });
    }
  }

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    const { shipmentId, delayHours, depth, pathFromTrigger } = item;
    const shipment = store.getById(shipmentId);
    if (!shipment) continue;

    const slaRemainingHours =
      (new Date(shipment.SLA_deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    const slaBreached = delayHours > Math.max(0, slaRemainingHours);

    const customer = store.customers.get(shipment.customer_id);
    const penaltyPerDay = customer?.sla_penalty_per_day_usd ?? 0;
    const slaExposureUsd = slaBreached
      ? Math.round(penaltyPerDay * (delayHours / 24))
      : 0;

    nodes.push({
      shipment_id: shipmentId,
      delay_hours: Math.round(delayHours),
      sla_breached: slaBreached,
      sla_exposure_usd: slaExposureUsd,
      hop_depth: depth,
    });
    nodePathMap.set(shipmentId, pathFromTrigger);

    // Continue BFS if within hop limit
    if (depth < MAX_HOPS) {
      const propagatedDelay = delayHours * DELAY_ATTENUATION;
      for (const depId of store.getDependents(shipmentId)) {
        if (!visited.has(depId)) {
          visited.add(depId);
          queue.push({
            shipmentId: depId,
            delayHours: propagatedDelay,
            depth: depth + 1,
            pathFromTrigger: [...pathFromTrigger, depId],
          });
        }
      }
    }
  }

  return { nodes, nodePathMap };
}

export function buildCriticalPath(
  triggerShipmentId: string,
  nodes: CascadeNode[],
  nodePathMap: Map<string, string[]>
): string[] {
  if (nodes.length === 0) return [triggerShipmentId];

  const highestExposureNode = nodes.reduce((max, node) =>
    node.sla_exposure_usd > max.sla_exposure_usd ? node : max
  );

  return nodePathMap.get(highestExposureNode.shipment_id) ?? [triggerShipmentId];
}
