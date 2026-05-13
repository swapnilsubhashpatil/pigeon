# Specification: Decision Engine

**Track ID:** TRK-004
**Type:** Feature
**Created:** 2026-05-13
**Status:** In Progress

## Summary

Integrate Gemini to generate three ranked reroute options (Safe / Aggressive / Defer) for any shipment whose `weighted_risk_score` exceeds 75. A rule engine auto-executes the best option when confidence is high; otherwise the decision is queued for manager approval. All decisions are audit-logged.

## Context

When the Risk Engine flags a shipment as critical (weighted_risk_score > 75), Pigeon needs to suggest — and where safe, autonomously take — corrective action. The Decision Engine is the bridge between risk detection and action.

## Acceptance Criteria

- [ ] `POST /api/v1/decisions/generate` accepts `{ shipmentId }`, calls Gemini, returns a `DecisionRecord` with 3 options
- [ ] Each option includes: label, action, cost_delta_usd, eta_delta_hours, sla_outcome, confidence_score, rationale
- [ ] Rule engine auto-executes if: confidence > 0.85 AND cost_delta < 50000 AND label != 'Defer'
- [ ] If not auto-executed, decision is stored with status `pending_approval`
- [ ] `GET /api/v1/decisions` returns all pending decisions
- [ ] `POST /api/v1/decisions/:id/approve` with `{ optionId }` marks a pending decision as approved
- [ ] `POST /api/v1/decisions/:id/reject` marks a pending decision as overridden
- [ ] `GET /api/v1/decisions/audit` returns full audit log
- [ ] Gemini call falls back gracefully to mock options if API key is missing

## Dependencies

TRK-001 (Backend Foundation) — complete
TRK-002 (Risk Engine) — complete

## Out of Scope

- Actual carrier booking or any external system calls beyond Gemini
- Email/Slack notifications (TRK-005)
- Frontend UI for the approval queue (frontend tracks)

## Technical Notes

- Gemini model: gemini-1.5-flash (fast enough for demo latency)
- Prompt: provide shipment details (origin, dest, legs, SLA deadline, risk scores) + disruption context
- Parse structured JSON from Gemini response, validate with zod
- safeFetch pattern: on Gemini error, return 3 hardcoded plausible mock options
- Auto-execute audit: status='auto_executed', resolved_by='auto'
- Manual approval audit: status='approved'/'overridden', resolved_by='manager'
