export type DisruptionType = 'weather' | 'port_congestion' | 'vessel_delay' | 'geopolitical' | 'strike' | 'customs';

export interface DisruptionEvent {
  event_id: string;
  type: DisruptionType;
  subtype: string;
  severity: number;
  affected_region: string;
  affected_lanes: string[];
  estimated_delay_hours: number;
  detected_at: string;
  source: string;
  resolved?: boolean;
  resolved_at?: string;
}
