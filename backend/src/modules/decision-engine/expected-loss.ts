import type { Shipment } from '@/types';
import type { GeneratedOption } from './options';
import type { DelayPrediction } from './predictor';

export interface RankedOption extends GeneratedOption {
  expected_loss_usd: number;
  expected_loss_breakdown: {
    direct_cost: number;
    sla_penalty: number;
    cascade_exposure: number;
  };
}

interface RankerInputs {
  shipment: Shipment;
  prediction: DelayPrediction;
  customerPenaltyPerDayUsd: number;
  cascadeExposureUsd: number;
}

/**
 * Expected loss minimization — standard actuarial decision framework.
 *
 *   E[loss] = direct_cost
 *           + P(SLA_breach | option) × penalty_per_day × breach_days
 *           + cascade_exposure × P(cascade_materialises | option)
 *
 * The option with the lowest expected loss is the recommended action.
 *
 *   P(SLA_breach | option):
 *     - "met"     → P(breach) × 0.10   (small chance the ML model is wrong)
 *     - "at_risk" → P(breach) × 0.55   (genuinely uncertain)
 *     - "missed"  → max(P(breach), 0.85)
 *
 *   P(cascade_materialises | option):
 *     - "met"     → 0.10
 *     - "at_risk" → 0.50
 *     - "missed"  → 0.90
 */
export function rankOptions(
  options: GeneratedOption[],
  inputs: RankerInputs
): RankedOption[] {
  const { prediction, customerPenaltyPerDayUsd, cascadeExposureUsd } = inputs;

  const ranked = options.map<RankedOption>((option) => {
    // P(breach | option) — modulated by the option's projected SLA outcome
    let pBreach: number;
    let pCascade: number;
    switch (option.sla_outcome) {
      case 'met':
        pBreach = prediction.breach_probability * 0.10;
        pCascade = 0.10;
        break;
      case 'at_risk':
        pBreach = prediction.breach_probability * 0.55;
        pCascade = 0.50;
        break;
      case 'missed':
        pBreach = Math.max(prediction.breach_probability, 0.85);
        pCascade = 0.90;
        break;
    }

    const breachDays = option.breach_hours / 24;
    const slaPenaltyComponent = Math.round(pBreach * customerPenaltyPerDayUsd * breachDays);
    const cascadeComponent = Math.round(cascadeExposureUsd * pCascade * pBreach);
    const directCost = Math.max(0, option.cost_delta_usd);

    const expectedLoss = directCost + slaPenaltyComponent + cascadeComponent;

    // Confidence: how strongly do we recommend this option?
    // High when SLA met + ML model agrees + low cascade risk.
    const slaFactor = option.sla_outcome === 'met' ? 0.95
                    : option.sla_outcome === 'at_risk' ? 0.55
                    : 0.20;
    const mlAgreement = option.sla_outcome === 'met'
      ? 1 - prediction.breach_probability * 0.5
      : prediction.breach_probability;
    const confidence = Math.min(0.99, Math.max(0.20, slaFactor * 0.7 + mlAgreement * 0.3));

    return {
      ...option,
      confidence_score: Math.round(confidence * 100) / 100,
      expected_loss_usd: expectedLoss,
      expected_loss_breakdown: {
        direct_cost: directCost,
        sla_penalty: slaPenaltyComponent,
        cascade_exposure: cascadeComponent,
      },
    };
  });

  // Sort by minimum expected loss
  ranked.sort((a, b) => a.expected_loss_usd - b.expected_loss_usd);
  return ranked;
}

/**
 * Selects the option to auto-execute, if any.
 *
 * Auto-execute fires for the lowest-expected-loss option that:
 *   - Is an active intervention (not Defer)
 *   - Guarantees SLA met (no risk tolerance for autonomous action)
 *   - Costs less than $50k (manager-approved threshold)
 *   - Has lower expected loss than doing nothing (Defer)
 *
 * Returns the chosen option or null if no option qualifies (queue for human).
 */
export function selectAutoExecuteOption(ranked: RankedOption[]): RankedOption | null {
  if (ranked.length === 0) return null;
  const deferLoss =
    ranked.find((o) => o.label === 'Defer')?.expected_loss_usd ?? Infinity;

  const candidates = ranked.filter(
    (r) =>
      r.label !== 'Defer' &&
      r.sla_outcome === 'met' &&
      r.cost_delta_usd < 50_000 &&
      r.expected_loss_usd < deferLoss
  );

  // ranked is already sorted by expected loss ascending — first candidate wins
  return candidates[0] ?? null;
}
