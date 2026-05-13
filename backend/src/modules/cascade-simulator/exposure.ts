import { store } from '@/store';
import type { CascadeImpactReport } from '@/types';
import { traverseGraph, buildCriticalPath } from './graph-traversal';

export function simulateCascade(
  triggerShipmentId: string,
  delayHours: number
): CascadeImpactReport {
  const { nodes, nodePathMap } = traverseGraph(triggerShipmentId, delayHours);

  const affectedShipments = nodes.map((n) => n.shipment_id);

  // Collect POs and customers from affected shipments (de-duped)
  const poSet = new Set<string>();
  const customerSet = new Set<string>();

  for (const node of nodes) {
    const shipment = store.getById(node.shipment_id);
    if (!shipment) continue;
    shipment.purchase_orders.forEach((po) => poSet.add(po));
    customerSet.add(shipment.customer_id);
  }

  const totalExposure = nodes.reduce((sum, n) => sum + n.sla_exposure_usd, 0);
  const criticalPath = buildCriticalPath(triggerShipmentId, nodes, nodePathMap);

  return {
    trigger_shipment: triggerShipmentId,
    affected_shipments: affectedShipments,
    affected_purchase_orders: Array.from(poSet),
    affected_customers: Array.from(customerSet),
    total_sla_exposure_usd: totalExposure,
    critical_path: criticalPath,
    cascade_nodes: nodes,
    computed_at: new Date().toISOString(),
  };
}
