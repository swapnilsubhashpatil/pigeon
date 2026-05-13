# Implementation Plan: Risk Engine

**Track ID:** TRK-002
**Spec:** [spec.md](./spec.md)
**Created:** 2026-05-13
\*\*Status:\*\* [x] Complete

## Overview

Eight phases: scaffold signal interfaces and the mock fallback pattern, implement each of the 5 signal sources, wire the scorer that aggregates them, then expose REST endpoints and the 15-min scheduler.

---

## Phase 1: Signal Module Scaffold

Define shared signal types, the base fetcher pattern, and mock score fallbacks used by every signal module.

### Tasks

- [x] 1.1: Create `src/modules/risk-engine/signals/types.ts` — `SignalScore`, `SignalResult<T>`, `LegSignalContext` interfaces
- [x] 1.2: Create `src/modules/risk-engine/signals/mock-scores.ts` — pre-seeded realistic mock scores per shipment lane/leg-type (used as fallback when API key missing)
- [x] 1.3: Create `src/modules/risk-engine/signals/fetcher.ts` — `safeFetch<T>` wrapper: calls the real fetch fn, catches errors, returns mock on failure, logs source + outcome

### Verification

- [x] `safeFetch` returns mock value when passed a function that throws
- [x] Mock scores cover all 8 lanes and 3 leg types

---

## Phase 2: Weather Signal (Tomorrow.io)

Fetch weather severity for ocean leg route segments and map to 0–100 risk.

### Tasks

- [x] 2.1: Create `src/modules/risk-engine/signals/weather.ts`
- [x] 2.2: Implement `fetchWeatherScore(lat: number, lon: number): Promise<number>` — calls Tomorrow.io `/v4/weather/forecast?location={lat},{lon}&apikey=KEY&fields=weatherCode,windSpeed,precipitationIntensity`
- [x] 2.3: Zod schema for Tomorrow.io response; extract `windSpeed` and `precipitationIntensity` from first hourly interval
- [x] 2.4: Map severity to score: windSpeed>50km/h → +40pts, >80→+65pts; precipIntensity>5mm/h → +20pts; sum capped at 100
- [x] 2.5: Add port midpoint coordinates map: `PORT_COORDS: Record<string, { lat: number; lon: number }>` for all 10 ports in seed data — used to derive ocean leg midpoint

### Verification

- [x] With valid API key: returns a number 0–100 for CNSHA→NLRTM midpoint
- [x] With missing key: `safeFetch` returns mock score, no crash

---

## Phase 3: Vessel Signal (aisstream.io)

Connect a persistent WebSocket to aisstream.io, cache vessel positions, compute position delta for ocean legs.

### Tasks

- [x] 3.1: Create `src/modules/risk-engine/signals/vessel.ts`
- [x] 3.2: Implement `startAisStream()` — opens `wss://stream.aisstream.io/v0/stream`, sends subscription with bounding boxes for 8 shipping lanes (South China Sea, North Atlantic, Pacific, Indian Ocean, Tasman Sea)
- [x] 3.3: On each AIS message: parse MMSI + lat/lon + speed + timestamp; upsert into `vesselCache: Map<string, VesselPosition>`
- [x] 3.4: Implement `fetchVesselDeltaScore(shipmentId: string): Promise<number>` — looks up carrier vessel in cache (matched by lane), computes positional delay vs expected progress, maps to 0–100
- [x] 3.5: Graceful reconnect on WebSocket close/error (exponential backoff, max 5 retries)
- [x] 3.6: If aisstream key missing or no matching vessel: return mock score via `safeFetch`

### Verification

- [x] WebSocket connects and starts receiving messages (log first 3 messages)
- [x] `vesselCache` is populated after 10 seconds
- [x] `fetchVesselDeltaScore` returns 0–100 for SH-4800

---

## Phase 4: Port Congestion Signal (VesselFinder)

Query VesselFinder for vessel count near port coordinates as a congestion proxy.

### Tasks

- [x] 4.1: Create `src/modules/risk-engine/signals/port.ts`
- [x] 4.2: Port coordinates map: `PORT_COORDS` (CNSHA, NLRTM, DEHAM, USLAX, GBFXT, JPYOK, SGSIN, INNSA, KRPUS, USNYC, AUMEL) — lat/lon + bounding box radius
- [x] 4.3: Implement `fetchPortCongestionScore(portCode: string): Promise<number>` — calls VesselFinder API `https://api.vesselfinder.com/vessels?userkey=KEY&lat={lat}&lon={lon}&radius=10` (radius in NM)
- [x] 4.4: Zod schema for VesselFinder response; count vessels in response array
- [x] 4.5: Map vessel count to score: <5=10, 5–15=30, 15–30=55, 30–50=75, >50=90

### Verification

- [x] With valid key: returns 0–100 for CNSHA
- [x] With missing key: returns mock score

---

## Phase 5: Traffic Signal (Google Maps Routes API)

Compute trucking leg ETA delta using live traffic vs baseline.

### Tasks

- [x] 5.1: Create `src/modules/risk-engine/signals/traffic.ts`
- [x] 5.2: Baseline ETA map: `TRUCKING_BASELINES: Record<string, number>` — hardcoded expected trucking durations in minutes per leg origin→destination (e.g. "Shanghai Factory→CNSHA": 90)
- [x] 5.3: Implement `fetchTrafficScore(origin: string, destination: string): Promise<number>` — calls Google Maps Routes API `https://routes.googleapis.com/directions/v2:computeRoutes` with `travelMode: DRIVE` and `routingPreference: TRAFFIC_AWARE_OPTIMAL`
- [x] 5.4: Zod schema for Routes API response; extract `duration` from first route
- [x] 5.5: Compute delay ratio: `(actualMinutes - baselineMinutes) / baselineMinutes`; map to score: ratio<0.1=10, 0.1–0.3=30, 0.3–0.6=55, >0.6=80
- [x] 5.6: If key missing or route not found: return mock score

### Verification

- [x] With valid key: returns 0–100 for a Shanghai→CNSHA trucking leg
- [x] With missing key: returns mock fallback

---

## Phase 6: Geopolitical Signal (NewsAPI + Gemini)

Fetch regional news headlines and classify disruption risk via Gemini.

### Tasks

- [x] 6.1: Create `src/modules/risk-engine/signals/geopolitical.ts`
- [x] 6.2: Region keyword map: `REGION_KEYWORDS: Record<string, string>` — maps port region to NewsAPI query string (e.g. CNSHA→"China port strike OR customs OR embargo", NLRTM→"Rotterdam port strike OR closure")
- [x] 6.3: Implement `fetchGeopoliticalScore(portCode: string): Promise<number>` — calls NewsAPI `https://newsapi.org/v2/everything?q={keywords}&language=en&pageSize=5&apiKey=KEY`
- [x] 6.4: Pass top-3 headlines to Gemini `gemini-1.5-flash` with structured prompt: classify supply chain disruption risk 0–3 (0=none, 1=low, 2=medium, 3=high), output JSON `{ risk_level: number, reason: string }`
- [x] 6.5: Map risk level: 0→5, 1→15, 2→35, 3→60
- [x] 6.6: Cache result per port for 30 minutes to avoid hammering both APIs

### Verification

- [x] With valid keys: returns 0–100 for CNSHA
- [x] Gemini returns valid JSON with risk_level 0–3
- [x] Cache prevents duplicate API calls within 30 min

---

## Phase 7: Scorer + Store Integration

Aggregate all signal scores per leg using weighted formula, update the store, and emit disruption events on threshold breach.

### Tasks

- [x] 7.1: Create `src/modules/risk-engine/scorer.ts`
- [x] 7.2: Implement `computeLegScore(leg, shipment): Promise<number>` — dispatches to correct signals by leg type:
  - trucking: `traffic*0.6 + geopolitical*0.4`
  - port: `portCongestion*0.7 + geopolitical*0.3`
  - ocean: `weather*0.5 + vesselDelta*0.3 + geopolitical*0.2`
- [x] 7.3: Implement `computeShipmentRisk(shipment): Promise<{ legScores, composite, urgencyMultiplier, weighted }>` — computes all legs, derives urgency multiplier from `SLA_deadline` vs now, returns full breakdown
- [x] 7.4: Implement `refreshShipment(shipmentId): Promise<Shipment>` — calls scorer, calls `store.updateRiskScore()`, checks if `weighted > 75` and if so calls `store.addDisruption()` with a generated `DisruptionEvent`
- [x] 7.5: Implement `refreshAll(): Promise<void>` — runs `refreshShipment` for all 40 shipments sequentially (avoid API rate limits)

### Verification

- [x] `computeShipmentRisk('SH-4800')` returns correct structure with all 5 legs scored
- [x] `refreshShipment('SH-4803')` (high-risk ship) triggers a disruption event in the store
- [x] `store.getActiveDisruptions()` returns the event after refresh

---

## Phase 8: REST Endpoints + Scheduler

Wire the scorer into Express routes and start the 15-minute auto-refresh scheduler.

### Tasks

- [x] 8.1: Create `src/routes/risk-scores.ts` — `GET /api/v1/risk-scores` (all ships with current scores), `GET /api/v1/risk-scores/:id` (single ship breakdown)
- [x] 8.2: `POST /api/v1/risk-scores/refresh` — triggers `refreshAll()`, returns summary count
- [x] 8.3: `POST /api/v1/risk-scores/refresh/:id` — triggers `refreshShipment(id)`, returns updated shipment
- [x] 8.4: Create `src/modules/risk-engine/scheduler.ts` — uses `setInterval` for 15-min refresh, logs start/completion of each cycle, catches and logs errors without crashing
- [x] 8.5: Create `src/modules/risk-engine/index.ts` — exports `initRiskEngine()`: starts AIS WebSocket + scheduler, called from `src/index.ts` on startup
- [x] 8.6: Mount risk-scores router in `src/index.ts`, call `initRiskEngine()` on startup

### Verification

- [x] `GET /api/v1/risk-scores` returns 40 shipments with updated scores
- [x] `POST /api/v1/risk-scores/refresh/SH-4800` returns updated shipment with fresh scores
- [x] Server starts, logs "Risk engine initialised", AIS WebSocket connects
- [x] Scheduler log appears every 15 min (verify with shortened 30s interval in dev)

---

## Final Verification

- [x] All 8 acceptance criteria in spec.md are met
- [x] All 5 signal sources return scores (real or mock) without crashing
- [x] `npm run typecheck` passes with zero errors
- [x] `GET /api/v1/health` still returns `{ status: "ok", shipmentCount: 40 }`
- [x] Ready to begin TRK-003 (Cascade Simulator)

---
_Generated by Conductor. Tasks marked [~] in progress, [x] complete._
