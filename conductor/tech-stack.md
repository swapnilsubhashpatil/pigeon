# Tech Stack — Pigeon

## Primary Language
TypeScript 5.x (strict mode) — used across backend and frontend

## Backend
- **Runtime:** Node.js 20+
- **Framework:** Express 5.x
- **Structure:** Modular monolith — single Express app, code split into feature modules
- **Package manager:** npm or bun

## Frontend (existing)
- **Framework:** React 19 + Vite 8
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript

## AI / ML
- **Decision engine + comms drafting:** Gemini 1.5 Pro (Google AI SDK for Node.js)
- **Geopolitical signal classification:** Gemini (NLP classifier on NewsAPI articles)
- **Risk scoring:** Weighted formula (no ML model for demo — deterministic scoring from signal inputs)

## External Signal APIs
| Signal | API | Notes |
|--------|-----|-------|
| Weather | Tomorrow.io REST API | Severe weather events, forecasts |
| Vessel positions | aisstream.io WebSocket | Live AIS ship lat/long, speed, heading |
| Port congestion | VesselFinder API | Vessel queue depth per port |
| Road traffic / trucking ETAs | Google Maps Routes API | |
| Geopolitical / news | NewsAPI + Gemini classifier | Strikes, customs shutdowns |

## Notifications
- **Slack:** Incoming Webhooks (auto-execute summaries)
- **SSE (Server-Sent Events):** Live risk score push to frontend (replaces Firestore for backend-only phase)

## Data Storage (Phase 1)
- **Shipment data:** In-memory store + JSON seed files (`src/data/`)
- **Dependency graph:** In-memory adjacency list
- **Audit log:** In-memory array (append-only)
- **Future:** Cloud SQL (PostgreSQL) + Firestore + BigQuery per design doc

## Infrastructure (target)
- **Deployment:** Google Cloud Run (containerised)
- **Dev:** Local Node.js server
- **Container:** Docker (added when ready to deploy)

## Key Dev Dependencies
- `tsx` — TypeScript execution for dev
- `zod` — runtime schema validation on all external API responses
- `axios` — HTTP client for external APIs
- `ws` — WebSocket client for AIS stream
- `@google/generative-ai` — Gemini SDK
