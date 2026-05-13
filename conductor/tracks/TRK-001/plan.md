# Implementation Plan: Backend Foundation

**Track ID:** TRK-001
**Spec:** [spec.md](./spec.md)
**Created:** 2026-05-13
**Status:** [x] Complete

## Overview

Five sequential phases: scaffold the project shell, define all TypeScript types, generate realistic seed data, wire up the in-memory store, then expose the base REST routes and verify end-to-end.

---

## Phase 1: Project Scaffold

Create the `backend/` directory with all config files and a minimal Express app that starts cleanly.

### Tasks

- [x] 1.1: Create `backend/package.json` with deps: `express`, `zod`, `axios`, `ws`, `@google/generative-ai`, `cors`, `dotenv`; devDeps: `tsx`, `typescript`, `@types/express`, `@types/node`, `@types/ws`, `@types/cors`
- [x] 1.2: Create `backend/tsconfig.json` — strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, path aliases (`@/*` → `src/*`), target ES2022, module NodeNext
- [x] 1.3: Create `backend/src/index.ts` — minimal Express app on `process.env.PORT ?? 3000`, JSON middleware, CORS, placeholder router mount
- [x] 1.4: Create `backend/src/config.ts` — validated env var loader (throws on missing required vars)
- [x] 1.5: Create `backend/.env.example` documenting all 8 required env vars
- [x] 1.6: Add `backend` to root `.gitignore` node_modules pattern (verify `backend/node_modules` is ignored)
- [x] 1.7: Add `dev` script: `tsx watch src/index.ts` and `build` script: `tsc`

### Verification

- [x] Run `npm install` in `backend/` — no errors
- [x] Run `npm run dev` — server starts, logs "Pigeon backend running on port 3000"
- [x] `curl http://localhost:3000/` returns any response (even 404)

---

## Phase 2: Data Models (TypeScript Types)

Define all shared TypeScript interfaces that every module will use. These must exactly match the JSON shapes in the system design doc.

### Tasks

- [x] 2.1: Create `src/types/shipment.ts` — `Leg`, `LegType`, `Shipment` interfaces (matching design doc JSON exactly, including `composite_risk_score`, `sla_urgency_multiplier`, `weighted_risk_score`)
- [x] 2.2: Create `src/types/disruption.ts` — `DisruptionEvent`, `DisruptionType` interfaces
- [x] 2.3: Create `src/types/cascade.ts` — `CascadeImpactReport`, `CascadeNode` interfaces
- [x] 2.4: Create `src/types/decision.ts` — `DecisionOption`, `DecisionLabel`, `DecisionAction`, `DecisionRecord` interfaces
- [x] 2.5: Create `src/types/graph.ts` — `DependencyEdge`, `DependencyGraph` (adjacency list: `Map<string, string[]>`) types
- [x] 2.6: Create `src/types/index.ts` — re-export all types from a single barrel
- [x] 2.7: Create `src/types/api.ts` — generic `ApiResponse<T>` wrapper type used by all route handlers

### Verification

- [x] `npm run typecheck` (tsc --noEmit) passes with zero errors
- [x] All types are importable via `@/types`

---

## Phase 3: Seed Data

Generate `src/data/shipments.json` with 40 synthetic but realistic shipments. Also generate `src/data/dependency-graph.json` defining the dependency edges between shipments.

### Tasks

- [x] 3.1: Create `src/data/shipments.json` — 40 shipments across 8 global lanes:
  - CNSHA→NLRTM (8 shipments, Maersk / Evergreen)
  - CNSHA→DEHAM (6 shipments, Hapag-Lloyd / MSC)
  - USLAX→GBFXT (5 shipments, CMA CGM)
  - JPYOK→USLAX (5 shipments, ONE)
  - SGSIN→NLRTM (4 shipments, MSC)
  - INNSAV→NLRTM (4 shipments, Hapag-Lloyd)
  - KRPUS→USNYC (4 shipments, Evergreen)
  - AUPML→DEHAM (4 shipments, Maersk)
  - Each shipment: id (SH-4800 to SH-4839), status, origin, destination, carrier, SLA_deadline (2–7 days from 2026-05-13), customer_id (CUST-001 to CUST-015), purchase_orders (1–2 PO refs), legs (L1–L6 with type and initial risk_score 5–90), composite_risk_score, sla_urgency_multiplier, weighted_risk_score
  - Risk profile distribution: 15 green (score <40), 15 amber (40–70), 10 critical (>70)
- [x] 3.2: Create `src/data/dependency-graph.json` — 20 edges defining which shipments depend on others (e.g. SH-4805 must arrive before SH-4810 can depart Hamburg consolidation)
- [x] 3.3: Create `src/data/customers.json` — 15 customer records with id, name, tier (gold/silver/bronze), sla_penalty_per_day_usd
- [x] 3.4: Create `src/data/index.ts` — exports typed loader functions that parse and zod-validate each JSON file at import time

### Verification

- [x] `src/data/index.ts` imports without throwing (zod validation passes on all 40 shipments)
- [x] Shipment count is exactly 40
- [x] At least one shipment from each of the 8 lanes

---

## Phase 4: In-Memory Store

Singleton module that loads all seed data on first import and exposes typed CRUD + query operations. This is the single source of truth for the backend during demo.

### Tasks

- [x] 4.1: Create `src/store/index.ts` — singleton class (or module-level state) that initialises from seed data on first import
- [x] 4.2: Shipment store operations: `getAll()`, `getById(id)`, `updateRiskScore(id, legScores)`, `updateStatus(id, status)`
- [x] 4.3: Disruption store operations: `getActiveDisruptions()`, `addDisruption(event)`, `resolveDisruption(eventId)`
- [x] 4.4: Decision store operations: `getPendingDecisions()`, `addDecision(record)`, `approveDecision(id)`, `getAuditLog()`
- [x] 4.5: Graph store: load `dependency-graph.json` into an in-memory adjacency list (`Map<string, string[]>`), expose `getDependents(shipmentId)`
- [x] 4.6: SSE subscriber registry: `subscribe(res)`, `unsubscribe(res)`, `broadcast(event)` — needed by TRK-005 but scaffolded here

### Verification

- [x] Import store in a test file, call `getAll()` — returns array of 40 typed Shipment objects
- [x] `getDependents('SH-4805')` returns expected downstream shipment IDs

---

## Phase 5: Base Routes

Wire up the health check and shipment read routes. This phase proves the full request→store→response path works.

### Tasks

- [x] 5.1: Create `src/routes/health.ts` — `GET /health` returns `{ status: "ok", shipmentCount: number, activeDisruptions: number }`
- [x] 5.2: Create `src/routes/shipments.ts` — `GET /shipments` (all, with optional `?status=` and `?minRisk=` query filters), `GET /shipments/:id` (404 if not found)
- [x] 5.3: Mount both routers in `src/index.ts` under `/api/v1`
- [x] 5.4: Add global error handler middleware in `src/index.ts` (Express 5 async errors propagate automatically)
- [x] 5.5: Add request logging middleware (simple console.log of method + path + status)

### Verification

- [x] `GET /api/v1/health` → `{ status: "ok", shipmentCount: 40, activeDisruptions: 0 }`
- [x] `GET /api/v1/shipments` → array of 40 shipments
- [x] `GET /api/v1/shipments/SH-4800` → correct single shipment object
- [x] `GET /api/v1/shipments/SH-9999` → `{ success: false, error: "Shipment not found" }` with 404 status
- [x] `GET /api/v1/shipments?minRisk=70` → only returns high-risk shipments

---

## Final Verification

- [x] All 8 acceptance criteria in spec.md are met
- [x] `npm run typecheck` passes with zero errors
- [x] Server starts cleanly with `npm run dev`
- [x] All 5 route smoke-tests pass manually
- [x] `.env.example` is complete and `.env` is gitignored
- [x] Ready to begin TRK-002 (Risk Engine)

---
_Generated by Conductor. Tasks marked [~] in progress, [x] complete._
