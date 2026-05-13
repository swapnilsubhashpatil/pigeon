# Specification: Real-time + Notifications

**Track ID:** TRK-005
**Type:** Feature
**Created:** 2026-05-13
**Status:** In Progress

## Summary

Add a Server-Sent Events (SSE) endpoint so the frontend can receive live risk score updates, cascade reports, and decision events without polling. Add a Slack webhook that fires whenever Pigeon auto-executes a decision.

## Context

The Risk Engine updates scores every 15 minutes and on manual refresh. The Cascade Simulator and Decision Engine emit events when triggered. The frontend Command Center needs to reflect these updates in real-time. The store already has subscribe/unsubscribe/broadcast infrastructure — this track wires it up.

## Acceptance Criteria

- [ ] `GET /api/v1/events` returns an SSE stream (Content-Type: text/event-stream)
- [ ] Risk score updates are broadcast as `data: { type: "risk_update", ... }`
- [ ] Cascade reports are broadcast as `data: { type: "cascade_report", ... }`
- [ ] Decision auto-executes are broadcast as `data: { type: "decision_auto_executed", ... }`
- [ ] Decision pending events are broadcast as `data: { type: "decision_pending", ... }`
- [ ] SSE sends a keepalive comment every 30 seconds to prevent timeout
- [ ] Slack webhook fires on auto-execute with shipment ID, option label, cost delta, rationale
- [ ] Slack call fails gracefully (logs warning, does not crash server)

## Dependencies

TRK-001–004 all complete.

## Out of Scope

- WebSocket (SSE is sufficient for unidirectional server→client streaming)
- Email notifications
- Push notifications

## Technical Notes

- SSE: set headers `Cache-Control: no-cache`, `X-Accel-Buffering: no`, call `res.flushHeaders()`
- 30-second keepalive: `setInterval(() => res.write(': keepalive\n\n'), 30000)`
- Clean up on client disconnect: `req.on('close', () => store.unsubscribe(res))`
- Slack: POST to `config.slackWebhookUrl` with JSON body, use axios. No-op if webhook URL is empty
- Slack message: Block Kit with summary of the auto-executed decision
