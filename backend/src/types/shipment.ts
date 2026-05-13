export type LegType = 'trucking' | 'ocean' | 'port' | 'rail' | 'air' | 'last-mile';

export type ShipmentStatus = 'pending' | 'in_transit' | 'at_port' | 'delayed' | 'delivered';

export interface Leg {
  leg_id: string;
  type: LegType;
  risk_score: number;
  origin?: string;
  destination?: string;
}

export interface PortRef {
  port: string;
  country: string;
}

export interface Shipment {
  shipment_id: string;
  status: ShipmentStatus;
  origin: PortRef;
  destination: PortRef;
  carrier: string;
  SLA_deadline: string;
  customer_id: string;
  purchase_orders: string[];
  legs: Leg[];
  composite_risk_score: number;
  sla_urgency_multiplier: number;
  weighted_risk_score: number;
}
