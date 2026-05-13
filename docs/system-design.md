# PIGEON — Product Requirements & System Design

### Predictive Intelligence for Global Operations & Network

> **One line:** An autonomous supply chain co-pilot that detects disruptions 24–72 hours early, simulates cascade failures, and executes reroute decisions — before a single delivery is missed.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Core Features](#4-core-features)
5. [User Flows](#5-user-flows)
6. [Technical Architecture](#6-technical-architecture)
7. [System Design — Component Deep Dive](#7-system-design--component-deep-dive)
8. [Data Models](#8-data-models)
9. [API & Integration Layer](#9-api--integration-layer)
10. [Tech Stack](#10-tech-stack)
11. [Implementation Status](#11-implementation-status)
12. [Demo Flow](#12-demo-flow)
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Product Overview

**Pigeon** is an AI-powered, autonomous logistics co-pilot designed for global supply chain operations. It continuously monitors heterogeneous transit signals, models downstream impact of disruptions across a live shipment dependency graph, and generates — or autonomously executes — optimized reroute decisions within seconds of a risk being detected.

Unlike traditional supply chain tools that alert managers after delays occur, Pigeon operates predictively — fusing weather, port, vessel, carrier, and geopolitical signals into a per-shipment risk score updated continuously. When a disruption is confirmed, Pigeon doesn't just notify — it calculates which shipments are affected, what the dollar exposure is, what the reroute options are, and (within pre-approved thresholds) executes the best one automatically.

---

## 2. Problem Statement

Global supply chains manage millions of concurrent shipments across volatile, complex transportation networks. The critical failure is not a lack of data — it is a lack of **connected, actionable intelligence at the moment of disruption.**

| Problem                           | Current Reality                                           |
| --------------------------------- | --------------------------------------------------------- |
| Disruptions detected too late     | Weather/port alerts arrive 6–12 hours after impact begins |
| Cascading failures are invisible  | One delayed shipment silently kills 10 downstream orders  |
| Rerouting is tribal knowledge     | "Senior Ramesh knows the backup carrier for that lane"    |
| Carrier ETAs are fiction          | Averages, not live-computed against real conditions       |
| Cost vs. speed tradeoff is manual | No tool gives a live cost-delta + SLA-impact side by side |
| Reactive, not preventive          | Teams fight fires; no system prevents them                |

**The gap Pigeon closes:** Detection → Decision → Action in under 4 minutes, not 4 hours.

---

## 3. Target Users

- **Logistics & supply chain managers** at mid-to-large enterprises handling international multi-modal shipments
- **Operations teams** managing complex supplier networks with SLA commitments to end customers
- **Freight forwarders and 3PLs** running high-volume, time-sensitive cargo across global lanes
- **C-suite supply chain leaders** needing real-time visibility into financial exposure from disruptions

---

## 4. Core Features

Pigeon is built around four production features, each solving a distinct layer of the disruption problem.

### Feature 1 — Predictive Risk Engine

**What it does:**
Continuously ingests and fuses multi-source signals to compute a live risk score (0–100) for every active shipment, per route segment, updated every 15 minutes. Flags high-risk shipments 24–72 hours before expected impact.

**How it works:**

Every shipment is broken into legs:

```
Factory → Trucking → Origin Port → Ocean Leg → Destination Port → Last Mile
  [L1]      [L2]        [L3]          [L4]            [L5]           [L6]
```

Each leg gets an independent risk score from:

- Live weather severity on that segment (Tomorrow.io)
- Vessel position vs. scheduled position delta (AIS via aisstream.io)
- Port congestion (vessel density from aisstream cache)
- Road traffic on trucking legs (Google Maps Routes API)
- Geopolitical signals (NewsData.io + Gemini NLP classification)

**Compound score formula:**

```
Shipment Risk Score = weighted_avg(leg_scores) × SLA_urgency_multiplier

SLA urgency multiplier:
  > 72hrs to deadline  → 1.0x
  48–72hrs             → 1.4x
  24–48hrs             → 1.8x
  < 24hrs              → 2.5x
```

**Output:**
- Live ranked list of at-risk shipments sorted by business criticality
- Per-leg risk breakdown visible to the user
- Threshold breach → triggers Cascade Impact Simulator automatically

---

### Feature 2 — Cascade Impact Simulator

**What it does:**
When a disruption is detected on any shipment, instantly traverses the dependency graph to identify every downstream shipment, warehouse, purchase order, and customer SLA affected — and computes total dollar exposure in real time.

**How it works:**

The system maintains a live **Shipment Dependency Graph** where nodes are:
- Shipments
- Warehouses / consolidation points
- Purchase orders
- Customer contracts (with SLA penalty rates)

Edges represent dependencies:
- Shipment X must arrive at Warehouse Y before Shipment Z can depart
- PO #4421 depends on Shipment X components arriving
- Customer A has a $28K/day SLA penalty on PO #4421

When Shipment X is disrupted:

```
Shipment X delayed 18hrs
  → Misses consolidation window at Hamburg (closes in 12hrs)
      → 4 co-loaded shipments also delayed
          → Warehouse Y receives partial order
              → PO #4421 cannot be fulfilled
                  → Customer SLA breach
                      → $180K penalty exposure
```

**Algorithm:** BFS traversal from the disrupted node with dollar-quantified exposure calculation.

**Output:**
- Impact report: "This disruption affects 11 shipments, 3 customers, $340K SLA exposure"
- Ranked list of downstream shipments by criticality

---

### Feature 3 — Autonomous Decision Engine

**What it does:**
For every confirmed disruption, generates 3 ranked reroute alternatives with full cost, ETA, SLA, and confidence scoring — and autonomously executes decisions that fall within pre-approved thresholds. Managers approve the rest in one tap.

**How it works:**

**Step 1 — ML Prediction:**
- XGBoost model trained on synthetic 5k-row dataset predicts P(SLA_breach) with ROC-AUC 0.985
- TypeScript tree-walker evaluates model at runtime

**Step 2 — Deterministic Option Generation:**
- Safe: Switch to alternate carrier, saves ~60% of disruption delay, SLA met
- Aggressive: Air freight option, 24h ahead of original schedule, highest cost
- Defer: Hold + monitor, cheapest, SLA at risk

**Step 3 — Expected Loss Ranking:**
```
E[loss] = direct_cost
        + P(SLA_breach|option) × penalty_per_day × breach_days
        + cascade_exposure × P(cascade_materializes|option)
```

**Step 4 — Gemini generates plain-English rationale** (one sentence per option)

**Step 5 — Auto-execute rule:**
```
IF option != 'Defer'
AND sla_outcome == 'met'
AND cost_delta < $50k
AND confidence > 80%
THEN auto_execute() + notify_slack()
```

**Output:**
- Ranked decision card with expected loss values, ML prediction, cost/SLA breakdown
- Auto-execution with Slack Block Kit notification
- Full audit trail of decision, execution, and outcome

---

### Feature 4 — Real-Time Events & Notifications

**What it does:**
Delivers live updates via Server-Sent Events (SSE) with snapshot-on-connect, and sends Slack webhooks on auto-executed decisions with full context.

**Features:**
- SSE endpoint `/api/v1/events` with 30-second keepalive
- Shipment updates stream in real time
- Auto-execute notifications include: shipment ID, decision taken, cost impact, SLA outcome
- Slack Block Kit formatted for mobile and desktop

---

## 5. User Flows

<details>
<summary><b>Flow A — Manager Morning Check-In</b></summary>

```
1. Manager opens Pigeon dashboard
2. Command Center loads — live risk feed
3. Risk feed shows top 5 at-risk shipments ranked by business impact
4. Manager clicks Shipment #SH-4821 (score: 87, SLA in 36hrs)
5. Sees: port congestion, weather event on ocean leg
6. Cascade preview: "If delayed 12hrs → 3 downstream shipments affected, $220K exposure"
7. Decision Engine shows 3 options — selects Option 1 (Carrier B switch)
8. Approves → system dispatches reroute, logs action, notifies carrier
```

</details>

<details>
<summary><b>Flow B — Autonomous Night-Time Execution</b></summary>

```
1. 2:00 AM — Typhoon warning issued for South China Sea
2. Risk Engine processes → 18 shipments flagged, risk scores spike
3. Cascade Simulator runs: "$1.2M exposure, 6 shipments critical"
4. Decision Engine evaluates each shipment
5. 4 shipments within auto-execute thresholds → rerouted automatically
6. Slack notification: "⚡ Auto-rerouted 4 shipments via Carrier B. SLA protected. Cost delta: +$1,840."
7. 2 shipments above threshold → approval cards queued for manager
8. Manager wakes up, reviews 2 cards, approves in 90 seconds
9. Total resolution time: 11 minutes from signal to action
```

</details>

<details>
<summary><b>Flow C — New Shipment Onboarding</b></summary>

```
1. Logistics team creates new shipment record
2. Inputs: origin, destination, cargo type, carrier, SLA deadline, customer, PO links
3. System auto-generates route segments (L1–L6)
4. Each segment assigned baseline risk score from historical data
5. Shipment added to dependency graph — linked to relevant POs and warehouses
6. Shipment appears in dashboard — green status, ready for monitoring
```

</details>

---

## 6. Technical Architecture

![System Architecture — Signal to Action](../5.%20Flow%20Diagram.svg)

### Data Flow — Signal to Action

```
External Signal Arrives
        │
        ▼
Risk Scoring Service
  ├─ Fetch signals from: Tomorrow.io, aisstream, Maps, NewsData
  ├─ Recompute per-leg risk scores via XGBoost predictor
  ├─ Update shipment risk scores in in-memory store
  └─ Check threshold → if breach:
        │
        ▼
Cascade Simulator
  ├─ BFS traversal on dependency graph
  ├─ Score each downstream node
  ├─ Compute dollar exposure via SLA lookup
  └─ Publish impact report → Decision Engine
        │
        ▼
Decision Engine
  ├─ Predict P(SLA_breach) via ML
  ├─ Generate 3 deterministic options
  ├─ Rank by expected loss
  ├─ Generate rationale via Gemini
  └─ Evaluate auto-execute rules
        ├─ Within threshold → auto_execute() + Slack notify
        └─ Above threshold → push approval card to frontend
```

---

## 7. System Design — Component Deep Dive

<details>
<summary><b>Risk Scoring Service</b></summary>

**Type:** Node.js/Express service with 15-minute scheduler

**Trigger:** Periodic scheduler + manual refresh endpoint

**Signal sources:**
- Tomorrow.io (weather severity on route)
- aisstream.io WebSocket (vessel positions + port congestion density)
- Google Maps Routes API (trucking ETA delta)
- NewsData.io (geopolitical events) + Gemini classifier

**Processing:**
- Batch-processes all shipments every 15 minutes
- Individual refresh on POST `/api/v1/risk-scores/refresh/:shipmentId`

**Model:** XGBoost tree-walker in TypeScript
- Trained on synthetic 5k-row dataset (carriers, lanes, seasonality)
- ROC-AUC 0.985 on breach prediction

**Storage:** In-memory store (JSON seed files for now)

**Output:** 
- GET `/api/v1/risk-scores` — all shipments with current scores
- GET `/api/v1/risk-scores/:id` — single shipment detail

**Latency target:** < 30 seconds per full refresh cycle

</details>

<details>
<summary><b>Cascade Simulator</b></summary>

**Type:** Node.js service

**Graph storage:** In-memory JSON dependency graph

**Traversal:** BFS from disrupted shipment node
- Max depth: 5 hops (covers 99%+ of real chains)
- Per-node: delay propagation × business impact scoring

**Dollar exposure:** 
- Customer SLA penalty rate lookup
- Per-day breach × estimated delay days

**Output:** 
- POST `/api/v1/cascade/:shipmentId` — impact report JSON
- Format: `{total_sla_exposure_usd, affected_shipments[], cascade_path[]}`

**Latency:** < 5 seconds per cascade run

</details>

<details>
<summary><b>Decision Engine</b></summary>

**Type:** Node.js service

**Input:** Disrupted shipment + cascade report + carrier alternatives

**Processing pipeline:**

1. **ML Prediction** → P(SLA_breach) via XGBoost tree-walker
2. **Option Generation** → Deterministic carrier rate tables + SLA math
3. **Expected-Loss Ranking** → E[loss] = cost + penalty + cascade
4. **Gemini Rationale** → Single-sentence explanation per option (rationale-only, not decision-making)
5. **Auto-Execute Rule** → Evaluates threshold: not-Defer, SLA-met, cost<$50k, confidence>80%

**Routes:**
- POST `/api/v1/decisions/:shipmentId` — generate decision
- PATCH `/api/v1/decisions/:id/approve` — manager approval
- PATCH `/api/v1/decisions/:id/reject` — manager rejection

**Output:** DecisionRecord with:
- 3 ranked DecisionOptions (label, action, cost_delta, eta_delta, sla_outcome, expected_loss, breakdown)
- auto_executed flag (true if within thresholds)
- selected_option_id (if auto-executed)

**Latency:** < 3 seconds per decision

</details>

<details>
<summary><b>Real-Time Events & Notifications</b></summary>

**SSE Endpoint:** GET `/api/v1/events`
- Sends snapshot of all shipments + decisions on connect
- Pushes live updates every 15 minutes (risk recalculation)
- 30-second keepalive to prevent connection drop
- Format: `data: {type, shipment_id, risk_score, decision_id, ...}\n\n`

**Slack Webhooks:**
- Triggered on auto-executed decisions
- Block Kit format with color (green for SLA-met, yellow for at-risk)
- Includes: decision ID, shipment, carrier, cost delta, SLA outcome
- Example: "⚡ Auto-rerouted SH-4821 → Hapag-Lloyd. SLA Protected. +$320"

</details>

---

## 8. Data Models

<details>
<summary><b>Core Models</b></summary>

### Shipment
```json
{
  "shipment_id": "SH-4821",
  "status": "in_transit",
  "carrier": "Maersk",
  "origin": { "port": "CNSHA" },
  "destination": { "port": "NLRTM" },
  "SLA_deadline": "2025-05-15T18:00:00Z",
  "customer_id": "CUST-001",
  "composite_risk_score": 82,
  "weighted_risk_score": 87,
  "sla_urgency_multiplier": 1.8
}
```

### DecisionRecord
```json
{
  "decision_id": "DEC-0001",
  "shipment_id": "SH-4821",
  "status": "auto_executed | pending_approval",
  "options": [
    {
      "option_id": "opt-safe",
      "label": "Safe",
      "action": "switch_carrier",
      "carrier": "Hapag-Lloyd",
      "cost_delta_usd": 800,
      "eta_delta_hours": 12,
      "sla_outcome": "met",
      "confidence_score": 0.94,
      "expected_loss_usd": 1200,
      "expected_loss_breakdown": {
        "direct_cost": 800,
        "sla_penalty": 400,
        "cascade_exposure": 0
      },
      "rationale": "Hapag-Lloyd has 94% on-time rate. Cost delta within threshold. SLA met with buffer.",
      "auto_executable": true
    }
  ],
  "delay_prediction": {
    "breach_probability": 0.18,
    "median_delay_hours": 14
  },
  "cascade_exposure_usd": 340000,
  "selected_option_id": "opt-safe",
  "resolved_at": "2025-05-14T02:34:00Z",
  "resolved_by": "auto"
}
```

### Cascade Report
```json
{
  "trigger_shipment": "SH-4821",
  "affected_shipments": ["SH-4830", "SH-4831"],
  "total_sla_exposure_usd": 340000,
  "cascade_path": ["SH-4821", "WH-HAMBURG", "SH-4831"]
}
```

</details>

---

## 9. API & Integration Layer

| Signal Source        | API / Service                | Data                           | Update Frequency |
| -------------------- | ---------------------------- | ------------------------------ | ---------------- |
| Weather              | Tomorrow.io API              | Severe weather, forecasts      | Every 15 min     |
| Vessel positions     | aisstream.io WebSocket       | Live ship lat/long, speed      | Real-time        |
| Port congestion      | aisstream vessel cache       | Vessel density near port       | Real-time        |
| Geopolitical/news    | NewsData.io + Gemini         | Strikes, customs, conflicts    | Every 30 min     |
| Road traffic         | Google Maps Routes API       | Trucking ETA delta             | Real-time        |
| Notifications        | Slack Webhooks               | Auto-execute summaries         | On event         |

---

## 10. Tech Stack

| Layer                | Technology                  | Role                                            |
| -------------------- | --------------------------- | ----------------------------------------------- |
| **Backend**          | Node.js + Express + TS      | API, risk engine, cascade, decision services    |
| **ML**               | XGBoost (Python) + TS tree  | Breach predictor, inference at runtime          |
| **AI Reasoning**     | Gemini 2.5 Flash            | Decision rationale generation (text-only)       |
| **Signal Ingestion** | Tomorrow.io, aisstream, Maps, NewsData | External signal APIs     |
| **In-Memory Store**  | JavaScript objects + JSON   | Shipments, decisions, cascade graph (v1)        |
| **Scheduling**       | Node.js setInterval         | 15-min risk recalculation                       |
| **Real-Time**        | Server-Sent Events (SSE)    | Live UI updates                                 |
| **Notifications**    | Slack Webhooks              | Auto-execute alerts                             |
| **Frontend**         | React + TypeScript (PRD)    | Decision approval interface                     |

---

## 11. Implementation Status

✅ **Complete:**
- Express/TS backend scaffold + data models
- Risk Engine: 5 signals (weather, vessel, port, traffic, geopolitical)
- Cascade Simulator: BFS traversal, dollar-quantified exposure
- ML: XGBoost breach predictor, TS tree-walker
- Decision Engine: Deterministic options, expected-loss ranker, auto-execute rule
- Real-Time: SSE events + Slack Block Kit webhooks
- All API endpoints: risk-scores, cascade, decisions, events

⏳ **In Progress:**
- Frontend PRD (API mapping, wireframes, decision card UI, TS types)

---

## 12. Demo Flow

**Setup:** 40 synthetic shipments pre-loaded across real global lanes. 3 injectable disruption scenarios.

**Story:** _It's 2 AM. A typhoon just formed in the South China Sea. 18 of your shipments are in that lane. Your logistics manager is asleep._

```
Step 1 — Show baseline
  → Dashboard displays 40 shipments, all low risk, green

Step 2 — Trigger typhoon event
  → Risk scores spike on 18 shipments (live update)
  → Alert: "18 shipments affected · $1.2M SLA exposure"

Step 3 — Auto-execution fires (within 3 seconds)
  → 4 shipments meet auto-execute rules
  → Slack notification: "⚡ Auto-rerouted SH-4821 via Hapag-Lloyd · SLA Protected · +$320"

Step 4 — Remaining 2 shipments need approval
  → Decision cards show 3 options ranked by expected loss
  → Option 1: Carrier B switch (+$800, SLA met) — recommended
  → Option 2: Air freight (+$4,200, SLA met)
  → Option 3: Hold — SLA MISSED ❌

Step 5 — Manager approves
  → Shipments resolve to green

Total time — disruption to resolved: < 4 minutes
```

---

## 13. Future Roadmap

| Phase | Feature                                    | Value                                          |
| ----- | ------------------------------------------ | ---------------------------------------------- |
| v1.1  | Database persistence (PostgreSQL)          | Replace in-memory store for production scale   |
| v1.2  | Multi-modal route optimizer                | Full O-D optimization, not per-leg             |
| v1.3  | Inventory buffer recommendations           | Safety stock suggestions for high-risk lanes   |
| v2.0  | Carbon emission scoring per route          | Eco-friendly reroute alternatives with CO₂     |
| v2.1  | Carrier negotiation AI agent               | Automated rate negotiation via Gemini          |
| v2.2  | Predictive demand-supply mismatch          | Demand forecasts + pre-positioning             |
| v3.0  | Industry benchmark resilience scores       | Compare vs. industry peers                     |

---

_Document version: 1.0 · Project: Pigeon · Google Solution Challenge 2025_
