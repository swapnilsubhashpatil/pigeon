export type DecisionLabel = 'Safe' | 'Aggressive' | 'Defer';
export type DecisionAction = 'switch_carrier' | 'air_freight' | 'hold' | 'reroute';
export type DecisionStatus = 'pending_approval' | 'auto_executed' | 'approved' | 'overridden';

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
