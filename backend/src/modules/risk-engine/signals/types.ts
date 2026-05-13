import type { Leg, Shipment } from '@/types';

export interface SignalResult {
  score: number;
  source: 'live' | 'mock';
  detail?: string;
}

export interface LegSignalContext {
  leg: Leg;
  shipment: Shipment;
  portCode?: string;
}
