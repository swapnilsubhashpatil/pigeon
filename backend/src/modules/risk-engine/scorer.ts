import { store } from '@/store';
import type { Shipment, DisruptionEvent } from '@/types';
import { fetchWeatherScore } from './signals/weather';
import { fetchVesselDeltaScore } from './signals/vessel';
import { fetchPortCongestionScore } from './signals/port';
import { fetchTrafficScore } from './signals/traffic';
import { fetchGeopoliticalScore } from './signals/geopolitical';

const DISRUPTION_THRESHOLD = 75;

function computeUrgencyMultiplier(slaDeadline: string): number {
  const hoursRemaining = (new Date(slaDeadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursRemaining > 72) return 1.0;
  if (hoursRemaining > 48) return 1.4;
  if (hoursRemaining > 24) return 1.8;
  return 2.5;
}

export interface RiskBreakdown {
  leg_id: string;
  type: string;
  score: number;
}

export interface ShipmentRiskResult {
  shipment_id: string;
  legs: RiskBreakdown[];
  composite_risk_score: number;
  sla_urgency_multiplier: number;
  weighted_risk_score: number;
}

async function scoreTruckingLeg(
  legOrigin: string,
  legDest: string,
  portCode: string
): Promise<number> {
  const [traffic, geopolitical] = await Promise.all([
    fetchTrafficScore(legOrigin, legDest),
    fetchGeopoliticalScore(portCode),
  ]);
  return Math.round(traffic * 0.6 + geopolitical * 0.4);
}

async function scorePortLeg(portCode: string): Promise<number> {
  const [congestion, geopolitical] = await Promise.all([
    fetchPortCongestionScore(portCode),
    fetchGeopoliticalScore(portCode),
  ]);
  return Math.round(congestion * 0.7 + geopolitical * 0.3);
}

async function scoreOceanLeg(
  originPort: string,
  destPort: string,
  slaDeadline: string
): Promise<number> {
  const [weather, vessel, geopolitical] = await Promise.all([
    fetchWeatherScore(originPort, destPort),
    fetchVesselDeltaScore(originPort, destPort, slaDeadline),
    fetchGeopoliticalScore(originPort),
  ]);
  return Math.round(weather * 0.5 + vessel * 0.3 + geopolitical * 0.2);
}

export async function computeShipmentRisk(shipment: Shipment): Promise<ShipmentRiskResult> {
  const legScores: RiskBreakdown[] = [];

  for (const leg of shipment.legs) {
    let score: number;

    if (leg.type === 'trucking' || leg.type === 'last-mile') {
      score = await scoreTruckingLeg(
        leg.origin ?? shipment.origin.port,
        leg.destination ?? shipment.destination.port,
        shipment.origin.port
      );
    } else if (leg.type === 'port') {
      const portCode = leg.origin ?? shipment.origin.port;
      score = await scorePortLeg(portCode);
    } else {
      // ocean, rail, air
      score = await scoreOceanLeg(
        shipment.origin.port,
        shipment.destination.port,
        shipment.SLA_deadline
      );
    }

    legScores.push({ leg_id: leg.leg_id, type: leg.type, score: Math.min(100, Math.max(0, score)) });
  }

  const composite = Math.round(
    legScores.reduce((sum, l) => sum + l.score, 0) / legScores.length
  );
  const urgencyMultiplier = computeUrgencyMultiplier(shipment.SLA_deadline);
  const weighted = Math.min(100, Math.round(composite * urgencyMultiplier));

  return {
    shipment_id: shipment.shipment_id,
    legs: legScores,
    composite_risk_score: composite,
    sla_urgency_multiplier: urgencyMultiplier,
    weighted_risk_score: weighted,
  };
}

export async function refreshShipment(shipmentId: string): Promise<Shipment | undefined> {
  const shipment = store.getById(shipmentId);
  if (!shipment) return undefined;

  const result = await computeShipmentRisk(shipment);

  const updatedShipment = store.updateRiskScore(
    shipmentId,
    result.legs.map((l) => ({ leg_id: l.leg_id, risk_score: l.score }))
  );

  if (result.weighted_risk_score > DISRUPTION_THRESHOLD) {
    const existing = store.getActiveDisruptions().find(
      (d) => d.affected_lanes.includes(`${shipment.origin.port}-${shipment.destination.port}`)
    );
    if (!existing) {
      const event: DisruptionEvent = {
        event_id: `EVT-AUTO-${shipmentId}-${Date.now()}`,
        type: 'weather',
        subtype: 'auto-detected',
        severity: result.weighted_risk_score / 100,
        affected_region: `${shipment.origin.port} → ${shipment.destination.port}`,
        affected_lanes: [`${shipment.origin.port}-${shipment.destination.port}`],
        estimated_delay_hours: Math.round((result.weighted_risk_score - 75) * 0.5),
        detected_at: new Date().toISOString(),
        source: 'risk-engine',
      };
      store.addDisruption(event);
      console.log(`[risk-engine/scorer] Disruption event emitted for ${shipmentId} (score: ${result.weighted_risk_score})`);
    }
  }

  return updatedShipment;
}

export async function refreshAll(): Promise<{ refreshed: number; errors: number }> {
  const shipments = store.getAll();
  let refreshed = 0;
  let errors = 0;

  for (const shipment of shipments) {
    try {
      await refreshShipment(shipment.shipment_id);
      refreshed++;
    } catch (err) {
      errors++;
      console.error(`[risk-engine/scorer] Error refreshing ${shipment.shipment_id}:`, err);
    }
    // Small delay to avoid hammering APIs
    await new Promise((r) => setTimeout(r, 100));
  }

  return { refreshed, errors };
}
