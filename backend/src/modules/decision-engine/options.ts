import type { DecisionOption, Shipment } from '@/types';

// Per-carrier per-lane base cost (USD). Rough but realistic for ocean freight FEU.
const CARRIER_LANE_RATES: Record<string, Record<string, number>> = {
  'Maersk':      { 'CNSHA-NLRTM': 18000, 'CNSHA-DEHAM': 19500, 'USLAX-GBFXT': 12500, 'JPYOK-USLAX': 9000,  'SGSIN-NLRTM': 16000, 'INNSA-NLRTM': 17000, 'KRPUS-USNYC': 13500, 'AUMEL-DEHAM': 21000 },
  'MSC':         { 'CNSHA-NLRTM': 17500, 'CNSHA-DEHAM': 19000, 'USLAX-GBFXT': 12000, 'JPYOK-USLAX': 8800,  'SGSIN-NLRTM': 15500, 'INNSA-NLRTM': 16500, 'KRPUS-USNYC': 13000, 'AUMEL-DEHAM': 20500 },
  'CMA CGM':     { 'CNSHA-NLRTM': 17000, 'CNSHA-DEHAM': 18500, 'USLAX-GBFXT': 12000, 'JPYOK-USLAX': 8500,  'SGSIN-NLRTM': 15000, 'INNSA-NLRTM': 16000, 'KRPUS-USNYC': 12500, 'AUMEL-DEHAM': 20000 },
  'Hapag-Lloyd': { 'CNSHA-NLRTM': 18500, 'CNSHA-DEHAM': 20000, 'USLAX-GBFXT': 13000, 'JPYOK-USLAX': 9200,  'SGSIN-NLRTM': 16500, 'INNSA-NLRTM': 17500, 'KRPUS-USNYC': 13800, 'AUMEL-DEHAM': 21500 },
  'ONE':         { 'CNSHA-NLRTM': 17200, 'CNSHA-DEHAM': 18700, 'USLAX-GBFXT': 12200, 'JPYOK-USLAX': 8400,  'SGSIN-NLRTM': 15200, 'INNSA-NLRTM': 16200, 'KRPUS-USNYC': 12700, 'AUMEL-DEHAM': 20200 },
  'Evergreen':   { 'CNSHA-NLRTM': 16800, 'CNSHA-DEHAM': 18200, 'USLAX-GBFXT': 11800, 'JPYOK-USLAX': 8200,  'SGSIN-NLRTM': 14800, 'INNSA-NLRTM': 15800, 'KRPUS-USNYC': 12300, 'AUMEL-DEHAM': 19800 },
  'COSCO':       { 'CNSHA-NLRTM': 16500, 'CNSHA-DEHAM': 18000, 'USLAX-GBFXT': 11500, 'JPYOK-USLAX': 8000,  'SGSIN-NLRTM': 14500, 'INNSA-NLRTM': 15500, 'KRPUS-USNYC': 12000, 'AUMEL-DEHAM': 19500 },
  'HMM':         { 'CNSHA-NLRTM': 16300, 'CNSHA-DEHAM': 17800, 'USLAX-GBFXT': 11400, 'JPYOK-USLAX': 7900,  'SGSIN-NLRTM': 14300, 'INNSA-NLRTM': 15300, 'KRPUS-USNYC': 11800, 'AUMEL-DEHAM': 19300 },
};

// Best alternate carrier per current carrier (by historical reliability)
const ALTERNATE_CARRIER: Record<string, string> = {
  'Maersk': 'Hapag-Lloyd', 'Hapag-Lloyd': 'Maersk',
  'MSC': 'CMA CGM',        'CMA CGM': 'MSC',
  'ONE': 'Evergreen',      'Evergreen': 'ONE',
  'COSCO': 'HMM',          'HMM': 'COSCO',
};

// Assumed cargo weight per shipment (kg) and air rate
const CARGO_WEIGHT_KG = 8500;
const AIR_RATE_PER_KG = 5.5;

// Typical SLA buffer (hours) — time between scheduled arrival and SLA deadline
// for a healthy shipment. Used as the "breach threshold" against delay-vs-baseline.
function computeBaselineBuffer(slaHoursRemaining: number): number {
  // Tight SLA windows have less buffer; comfortable ones have ~48h
  if (slaHoursRemaining <= 24) return 6;
  if (slaHoursRemaining <= 48) return 18;
  if (slaHoursRemaining <= 72) return 30;
  return 48;
}

function laneKey(shipment: Shipment): string {
  return `${shipment.origin.port}-${shipment.destination.port}`;
}

function getCarrierLaneRate(carrier: string, lane: string): number {
  const carrierRates = CARRIER_LANE_RATES[carrier];
  return carrierRates?.[lane] ?? 15000;
}

function outcomeFromBreachHours(breachHours: number): 'met' | 'at_risk' | 'missed' {
  if (breachHours <= 1) return 'met';
  if (breachHours <= 12) return 'at_risk';
  return 'missed';
}

export interface GeneratedOption extends Omit<DecisionOption, 'rationale' | 'auto_executable'> {
  breach_hours: number;
}

/**
 * Generates three deterministic reroute options for a disrupted shipment.
 *
 * `currentDelayHours` is the disruption-induced delay vs the original schedule
 * (positive = arrives later than planned).
 *
 * eta_delta_hours is expressed as delay-vs-original-schedule:
 *   negative = earlier than originally planned
 *   positive = later than originally planned
 *
 * breach_hours is how much later than the SLA buffer the shipment arrives:
 *   0 = SLA comfortably met
 *   >0 = will breach SLA by N hours
 */
export function generateOptions(
  shipment: Shipment,
  currentDelayHours: number
): GeneratedOption[] {
  const lane = laneKey(shipment);
  const currentRate = getCarrierLaneRate(shipment.carrier, lane);
  const slaHoursRemaining = Math.max(
    0,
    (new Date(shipment.SLA_deadline).getTime() - Date.now()) / 3.6e6
  );
  const baselineBuffer = computeBaselineBuffer(slaHoursRemaining);

  // ────────────── OPTION 1: SAFE (switch carrier) ──────────────
  const altCarrier = ALTERNATE_CARRIER[shipment.carrier] ?? 'CMA CGM';
  const altRate = getCarrierLaneRate(altCarrier, lane);
  // Switching fee + rate differential
  const safeCostDelta = Math.round(Math.max(0, altRate - currentRate) + 2500);
  // Saves ~60% of the disruption delay (alternate carrier still hits some impact)
  const safeFinalDelay = Math.round(currentDelayHours * 0.4);
  const safeBreachHours = Math.max(0, safeFinalDelay - baselineBuffer);

  // ────────────── OPTION 2: AGGRESSIVE (air freight) ──────────────
  // Air freight is ~95% premium over ocean — arrives ~48h after dispatch
  const airCost = Math.round(CARGO_WEIGHT_KG * AIR_RATE_PER_KG);
  const aggressiveCostDelta = Math.round(airCost - currentRate * 0.4);
  // Arrives ~24h ahead of original schedule (huge time savings)
  const aggressiveFinalDelay = -24;
  const aggressiveBreachHours = 0;

  // ────────────── OPTION 3: DEFER (hold + monitor) ──────────────
  const deferFinalDelay = currentDelayHours;
  const deferBreachHours = Math.max(0, deferFinalDelay - baselineBuffer);

  return [
    {
      option_id: 'opt-safe',
      label: 'Safe',
      action: 'switch_carrier',
      carrier: altCarrier,
      cost_delta_usd: safeCostDelta,
      eta_delta_hours: safeFinalDelay,
      sla_outcome: outcomeFromBreachHours(safeBreachHours),
      confidence_score: 0,
      breach_hours: safeBreachHours,
    },
    {
      option_id: 'opt-aggressive',
      label: 'Aggressive',
      action: 'air_freight',
      cost_delta_usd: aggressiveCostDelta,
      eta_delta_hours: aggressiveFinalDelay,
      sla_outcome: outcomeFromBreachHours(aggressiveBreachHours),
      confidence_score: 0,
      breach_hours: aggressiveBreachHours,
    },
    {
      option_id: 'opt-defer',
      label: 'Defer',
      action: 'hold',
      cost_delta_usd: 0,
      eta_delta_hours: deferFinalDelay,
      sla_outcome: outcomeFromBreachHours(deferBreachHours),
      confidence_score: 0,
      breach_hours: deferBreachHours,
    },
  ];
}
