import axios from 'axios';
import { config } from '@/config';
import type { DecisionRecord } from '@/types';

export async function notifyAutoExecuted(record: DecisionRecord): Promise<void> {
  if (!config.slackWebhookUrl) return;

  const selected = record.options.find((o) => o.option_id === record.selected_option_id);
  if (!selected) return;

  const costSign = selected.cost_delta_usd >= 0 ? '+' : '';
  const etaSign = selected.eta_delta_hours <= 0 ? '' : '+';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🤖 Pigeon Auto-Executed a Decision' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Shipment:*\n${record.shipment_id}` },
          { type: 'mrkdwn', text: `*Decision:*\n${record.decision_id}` },
          { type: 'mrkdwn', text: `*Action:*\n${selected.label} — ${selected.action.replace('_', ' ')}` },
          { type: 'mrkdwn', text: `*Cost Delta:*\n${costSign}$${selected.cost_delta_usd.toLocaleString()}` },
          { type: 'mrkdwn', text: `*ETA Delta:*\n${etaSign}${selected.eta_delta_hours}h` },
          { type: 'mrkdwn', text: `*Confidence:*\n${Math.round(selected.confidence_score * 100)}%` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Rationale:* ${selected.rationale}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Executed at ${record.resolved_at} by Pigeon autopilot` }],
      },
    ],
  };

  try {
    await axios.post(config.slackWebhookUrl, payload);
    console.log(`[notifications/slack] Sent auto-execute alert for ${record.decision_id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[notifications/slack] Failed to send alert: ${msg}`);
  }
}
