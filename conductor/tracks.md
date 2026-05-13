# Tracks Registry

| Status | Track ID | Title | Created | Updated |
|--------|----------|-------|---------|---------|
| complete | TRK-001 | Backend Foundation | 2026-05-13 | 2026-05-13 |
| complete | TRK-002 | Risk Engine | 2026-05-13 | 2026-05-13 |
| complete | TRK-003 | Cascade Simulator | 2026-05-13 | 2026-05-13 |
| complete | TRK-004 | Decision Engine | 2026-05-13 | 2026-05-13 |
| complete | TRK-005 | Real-time + Notifications | 2026-05-13 | 2026-05-13 |

## Track Descriptions

**TRK-001 Backend Foundation**
Express + TypeScript scaffold, shared data models (Shipment, Disruption, Decision), in-memory store, 40 synthetic shipments seed data across real global lanes.

**TRK-002 Risk Engine**
Signal ingestion from Tomorrow.io (weather), aisstream.io (AIS vessel positions), VesselFinder (port congestion), Google Maps Routes API (trucking ETAs). Per-leg risk score computation using weighted formula. REST endpoints to query current risk scores.

**TRK-003 Cascade Simulator**
In-memory shipment dependency graph (adjacency list). BFS traversal from a disrupted shipment node. Dollar exposure calculation via SLA penalty data. REST endpoint: POST /simulate with shipment ID returns full cascade impact report.

**TRK-004 Decision Engine**
Gemini 1.5 Pro integration for reroute option generation and rationale. 3-option output (Safe / Aggressive / Defer). Auto-execute rule engine (threshold evaluation). Audit log of all decisions and actions.

**TRK-005 Real-time + Notifications**
SSE endpoint for live risk score streaming to frontend. Slack webhook integration for auto-execute notifications. Manager approval queue endpoint.
