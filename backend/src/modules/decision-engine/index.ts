import { store } from '@/store';
import type { DecisionRecord, DecisionOption, Shipment } from '@/types';
import { simulateCascade } from '@/modules/cascade-simulator';
import { notifyAutoExecuted } from '@/modules/notifications/slack';
import { delayPredictor, encodeCarrier, encodeLane, type PredictorFeatures } from './predictor';
import { generateOptions } from './options';
import { rankOptions, selectAutoExecuteOption, type RankedOption } from './expected-loss';
import { generateRationales } from './gemini';

let decisionCounter = 0;

function nextDecisionId(): string {
  return `DEC-${String(++decisionCounter).padStart(4, '0')}`;
}

/**
 * Derives the per-signal scores needed by the predictor from the shipment's
 * existing leg structure. This is an approximation — the legs already contain
 * the composite of weather + vessel + port + traffic + geopolitical signals
 * for that segment, so we use leg type as a proxy.
 */
function buildPredictorFeatures(shipment: Shipment): PredictorFeatures {
  const oceanLeg = shipment.legs.find((l) => l.type === 'ocean');
  const portLegs = shipment.legs.filter((l) => l.type === 'port');
  const truckingLegs = shipment.legs.filter((l) => l.type === 'trucking' || l.type === 'last-mile');

  const avg = (nums: number[]) =>
    nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;

  // Weather and vessel risk both ride on the ocean leg; split it
  const oceanRisk = oceanLeg?.risk_score ?? 0;
  const portCongestion = avg(portLegs.map((l) => l.risk_score));
  const traffic = avg(truckingLegs.map((l) => l.risk_score));

  // Geopolitical is baked into every leg's score in the scorer — use the
  // composite as a proxy with a small discount
  const geopolitical = Math.round(shipment.composite_risk_score * 0.6);

  const slaHoursRemaining = Math.max(
    0,
    (new Date(shipment.SLA_deadline).getTime() - Date.now()) / 3.6e6
  );

  return {
    weather_score: Math.round(oceanRisk * 0.6),
    vessel_delta_score: Math.round(oceanRisk * 0.4),
    port_congestion_score: Math.round(portCongestion),
    traffic_score: Math.round(traffic),
    geopolitical_score: geopolitical,
    composite_risk_score: shipment.composite_risk_score,
    sla_hours_remaining: Math.round(slaHoursRemaining),
    sla_urgency_multiplier: shipment.sla_urgency_multiplier,
    carrier_encoded: encodeCarrier(shipment.carrier),
    lane_encoded: encodeLane(shipment.origin.port, shipment.destination.port),
  };
}

function estimateCurrentDelayHours(shipment: Shipment): number {
  // Maps weighted risk score to delay hours. A score of 75 (threshold)
  // implies a ~24h disruption; 100 implies ~72h (major weather event).
  return Math.max(12, Math.round((shipment.weighted_risk_score - 60) * 1.8));
}

function rankedToDecisionOption(r: RankedOption, rationale: string): DecisionOption {
  const isMet = r.sla_outcome === 'met';
  const autoExecutable = r.label !== 'Defer' && isMet && r.cost_delta_usd < 50_000;

  return {
    option_id: r.option_id,
    label: r.label,
    action: r.action,
    ...(r.carrier !== undefined ? { carrier: r.carrier } : {}),
    cost_delta_usd: r.cost_delta_usd,
    eta_delta_hours: r.eta_delta_hours,
    sla_outcome: r.sla_outcome,
    confidence_score: r.confidence_score,
    rationale,
    auto_executable: autoExecutable,
    expected_loss_usd: r.expected_loss_usd,
    expected_loss_breakdown: r.expected_loss_breakdown,
    breach_hours: Math.round(r.breach_hours),
  };
}

export async function generateDecision(shipmentId: string): Promise<DecisionRecord> {
  const shipment = store.getById(shipmentId);
  if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);

  // 1. ML PREDICTION — P(SLA_breach) from XGBoost
  const features = buildPredictorFeatures(shipment);
  const prediction = delayPredictor.predict(features);

  // 2. CASCADE EXPOSURE — financial blast radius from BFS simulation
  const estimatedDelayHours = estimateCurrentDelayHours(shipment);
  const cascadeReport = simulateCascade(shipmentId, estimatedDelayHours);

  // 3. CUSTOMER PENALTY — real number from seed data
  const customer = store.customers.get(shipment.customer_id);
  const penaltyPerDay = customer?.sla_penalty_per_day_usd ?? 5000;

  // 4. DETERMINISTIC OPTION GENERATION — rate tables, SLA math
  const options = generateOptions(shipment, estimatedDelayHours);

  // 5. EXPECTED LOSS RANKING — math, not AI opinion
  const ranked = rankOptions(options, {
    shipment,
    prediction,
    customerPenaltyPerDayUsd: penaltyPerDay,
    cascadeExposureUsd: cascadeReport.total_sla_exposure_usd,
  });

  // 6. GEMINI — rationale text only (one sentence per option)
  const rationales = await generateRationales(shipment, ranked);

  // 7. ASSEMBLE — convert ranked options to API-shape DecisionOption objects
  const decisionOptions = ranked.map((r, i) =>
    rankedToDecisionOption(r, rationales[i] ?? '')
  );

  // 8. AUTO-EXECUTE DECISION — cheapest SLA-met intervention, if any qualify
  const autoExecuteChoice = selectAutoExecuteOption(ranked);

  const now = new Date().toISOString();
  const record: DecisionRecord = {
    decision_id: nextDecisionId(),
    shipment_id: shipmentId,
    trigger_event_id: `risk-threshold-${Date.now()}`,
    options: decisionOptions,
    status: autoExecuteChoice ? 'auto_executed' : 'pending_approval',
    created_at: now,
    delay_prediction: prediction,
    estimated_delay_hours: estimatedDelayHours,
    cascade_exposure_usd: cascadeReport.total_sla_exposure_usd,
    ...(autoExecuteChoice ? {
      selected_option_id: autoExecuteChoice.option_id,
      resolved_at: now,
      resolved_by: 'auto' as const,
    } : {}),
  };

  store.addDecision(record);

  if (autoExecuteChoice) {
    console.log(
      `[decision-engine] Auto-executed ${record.decision_id} for ${shipmentId} — ` +
      `${autoExecuteChoice.label} (E[loss]=$${autoExecuteChoice.expected_loss_usd.toLocaleString()}, P(breach)=${prediction.breach_probability})`
    );
    void notifyAutoExecuted(record);
  } else {
    const top = ranked[0]!;
    console.log(
      `[decision-engine] Queued ${record.decision_id} for ${shipmentId} — pending approval ` +
      `(top: ${top.label}, E[loss]=$${top.expected_loss_usd.toLocaleString()}, SLA: ${top.sla_outcome})`
    );
  }

  return record;
}
