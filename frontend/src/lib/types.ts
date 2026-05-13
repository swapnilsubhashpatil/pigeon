/** @format */

export type LegType = 'trucking' | 'ocean' | 'port' | 'rail' | 'air' | 'last-mile';
export type ShipmentStatus = 'pending' | 'in_transit' | 'at_port' | 'delayed' | 'delivered';
export type DecisionLabel = 'Safe' | 'Aggressive' | 'Defer';
export type DecisionAction = 'switch_carrier' | 'air_freight' | 'hold' | 'reroute';
export type DecisionStatus = 'pending_approval' | 'auto_executed' | 'approved' | 'overridden';

export interface Leg {
  leg_id: string;
  type: LegType;
  risk_score: number;
  origin?: string;
  destination?: string;
}

export interface Shipment {
  shipment_id: string;
  status: ShipmentStatus;
  origin: { port: string; country: string };
  destination: { port: string; country: string };
  carrier: string;
  SLA_deadline: string;
  customer_id: string;
  purchase_orders: string[];
  legs: Leg[];
  composite_risk_score: number;
  sla_urgency_multiplier: number;
  weighted_risk_score: number;
}

export interface ExpectedLossBreakdown {
  direct_cost: number;
  sla_penalty: number;
  cascade_exposure: number;
}

export interface DecisionOption {
  option_id: string;
  label: DecisionLabel;
  action: DecisionAction;
  carrier?: string;
  cost_delta_usd: number;
  eta_delta_hours: number;
  sla_outcome: 'met' | 'at_risk' | 'missed';
  confidence_score: number;
  rationale: string;
  auto_executable: boolean;
  expected_loss_usd?: number;
  expected_loss_breakdown?: ExpectedLossBreakdown;
  breach_hours?: number;
}

export interface DelayPredictionSummary {
  breach_probability: number;
  breach_likely: boolean;
}

export interface DecisionRecord {
  decision_id: string;
  shipment_id: string;
  trigger_event_id: string;
  options: DecisionOption[];
  selected_option_id?: string;
  status: DecisionStatus;
  created_at: string;
  resolved_at?: string;
  resolved_by?: 'auto' | 'manager';
  delay_prediction?: DelayPredictionSummary;
  estimated_delay_hours?: number;
  cascade_exposure_usd?: number;
}

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

export interface DisruptionEvent {
  event_id: string;
  type: string;
  subtype: string;
  severity: number;
  affected_region: string;
  affected_lanes: string[];
  estimated_delay_hours: number;
  detected_at: string;
  source: string;
  resolved: boolean;
  resolved_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | Record<string, string[]>;
}

export interface FeedItem {
  id: string;
  type: 'risk_update' | 'disruption' | 'cascade' | 'decision_pending' | 'auto_executed' | 'approved' | 'overridden';
  message: string;
  timestamp: number;
  payload?: unknown;
}

export interface SseSnapshot {
  type: 'snapshot';
  shipments: Array<{
    shipment_id: string;
    composite_risk_score: number;
    weighted_risk_score: number;
    status: ShipmentStatus;
  }>;
  active_disruptions: number;
  pending_decisions: number;
}

export interface SseRiskUpdate {
  type: 'risk_update';
  shipment_id: string;
  composite_risk_score: number;
  weighted_risk_score: number;
}

export interface SseDisruption {
  type: 'disruption';
  event: DisruptionEvent;
}

export interface SseCascadeReport {
  type: 'cascade_report';
  report: CascadeImpactReport;
}

export interface SseDecisionPending {
  type: 'decision_pending';
  record: DecisionRecord;
}

export interface SseDecisionAutoExecuted {
  type: 'decision_auto_executed';
  record: DecisionRecord;
}

export type SseEvent =
  | SseSnapshot
  | SseRiskUpdate
  | SseDisruption
  | SseCascadeReport
  | SseDecisionPending
  | SseDecisionAutoExecuted;
