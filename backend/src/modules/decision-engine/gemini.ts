import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { config } from '@/config';
import type { Shipment } from '@/types';
import type { RankedOption } from './expected-loss';

const RationaleSchema = z.object({
  rationales: z.array(z.string()).length(3),
});

/**
 * Builds a deterministic mock rationale per option. Used when Gemini is
 * unavailable or returns an unparseable response.
 */
function mockRationale(option: RankedOption, shipment: Shipment): string {
  const cost = option.cost_delta_usd === 0
    ? 'no added cost'
    : `+$${option.cost_delta_usd.toLocaleString()}`;

  const etaText = option.eta_delta_hours < 0
    ? `arrives ${Math.abs(option.eta_delta_hours)}h earlier`
    : option.eta_delta_hours > 0
      ? `delays arrival by ${option.eta_delta_hours}h`
      : 'no ETA change';

  const lossPart = option.expected_loss_usd === 0
    ? 'no expected loss'
    : `expected loss $${option.expected_loss_usd.toLocaleString()}`;

  switch (option.label) {
    case 'Safe':
      return `Switch ${shipment.shipment_id} to ${option.carrier}: ${cost}, ${etaText}, SLA ${option.sla_outcome} — ${lossPart}.`;
    case 'Aggressive':
      return `Air freight ${shipment.shipment_id}: ${cost}, ${etaText}, SLA ${option.sla_outcome} — ${lossPart}.`;
    case 'Defer':
      return `Hold ${shipment.shipment_id}: ${cost}, ${etaText}, SLA ${option.sla_outcome} — ${lossPart}.`;
  }
}

function buildPrompt(shipment: Shipment, ranked: RankedOption[]): string {
  const hoursRemaining = Math.round(
    (new Date(shipment.SLA_deadline).getTime() - Date.now()) / 3.6e6
  );

  const optionLines = ranked.map((o, i) => (
    `${i + 1}. ${o.label} (${o.action}${o.carrier ? ` via ${o.carrier}` : ''})
       cost_delta: $${o.cost_delta_usd.toLocaleString()}
       eta_delta_hours: ${o.eta_delta_hours}
       sla_outcome: ${o.sla_outcome}
       expected_loss: $${o.expected_loss_usd.toLocaleString()}
       breakdown: direct_cost=$${o.expected_loss_breakdown.direct_cost.toLocaleString()}, sla_penalty=$${o.expected_loss_breakdown.sla_penalty.toLocaleString()}, cascade_exposure=$${o.expected_loss_breakdown.cascade_exposure.toLocaleString()}`
  )).join('\n');

  return `You are an autonomous supply chain co-pilot. The decision engine has already computed three reroute options for a disrupted shipment using a deterministic expected-loss optimiser. Your job is to write a brief, factual rationale for each option — ONE sentence per option, explaining WHY the numbers look the way they do.

Shipment: ${shipment.shipment_id}
Route: ${shipment.origin.port} → ${shipment.destination.port}
Carrier: ${shipment.carrier}
SLA deadline: ${shipment.SLA_deadline} (${hoursRemaining}h remaining)
Weighted risk score: ${shipment.weighted_risk_score}/100

OPTIONS (already ranked by expected loss, lowest first):
${optionLines}

Respond with ONLY valid JSON, no markdown fences:
{ "rationales": ["<rationale for option 1>", "<rationale for option 2>", "<rationale for option 3>"] }

Rules:
- One sentence per rationale, max 25 words.
- Reference the specific cost, ETA, or SLA outcome — do not be vague.
- Do NOT invent numbers; use the ones provided.
- Match the order of the options exactly.`;
}

export async function generateRationales(
  shipment: Shipment,
  ranked: RankedOption[]
): Promise<string[]> {
  if (!config.geminiApiKey) {
    return ranked.map((o) => mockRationale(o, shipment));
  }

  try {
    const genai = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = buildPrompt(shipment, ranked);

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');

    const parsed = RationaleSchema.parse(JSON.parse(jsonMatch[0]));
    return parsed.rationales;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[decision-engine/gemini] Falling back to mock rationale: ${msg}`);
    return ranked.map((o) => mockRationale(o, shipment));
  }
}
