export interface CascadeNode {
  shipment_id: string;
  delay_hours: number;
  sla_breached: boolean;
  sla_exposure_usd: number;
  hop_depth: number;
}

export interface CascadeImpactReport {
  trigger_shipment: string;
  affected_shipments: string[];
  affected_purchase_orders: string[];
  affected_customers: string[];
  total_sla_exposure_usd: number;
  critical_path: string[];
  cascade_nodes: CascadeNode[];
  computed_at: string;
}
