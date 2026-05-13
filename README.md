# Pigeon 🐦

**Autonomous AI-powered supply chain co-pilot that detects disruptions 24–72 hours early, simulates cascade failures, and executes reroute decisions — before a single delivery is missed.**

Built for the **Google Solution Challenge 2025**.

---

## Quick Start

```bash
# Backend setup
cd backend
npm install
cp .env.example .env  # Add your API keys
npm run dev

# Frontend (coming soon)
cd ../frontend
npm install
npm start
```

Backend runs on `http://localhost:3000`  
API docs: `GET http://localhost:3000/api/v1/shipments` (start here)

---

## What is Pigeon?

Pigeon is an end-to-end supply chain platform that:

1. **Detects disruptions early** — Continuous multi-signal monitoring (weather, port, vessel, geopolitical)
2. **Models financial impact** — BFS dependency graph traversal to quantify cascade exposure
3. **Generates reroute decisions** — ML-powered breach prediction + deterministic option generation
4. **Executes autonomously** — Pre-approved decisions execute within seconds, with Slack notifications

**Core value:** Detection → Decision → Action in **under 4 minutes** (not 4 hours).

---

## Features

<details>
<summary><b>1. Predictive Risk Engine</b></summary>

Continuously monitors 5 independent signal sources and computes a live risk score (0–100) for every shipment leg, updated every 15 minutes.

**Signals:**
- 🌧️ **Weather** — Tomorrow.io for severe weather on ocean routes
- ⛴️ **Vessel Position** — aisstream.io AIS WebSocket for real-time ship lat/long vs. scheduled position
- 🚢 **Port Congestion** — Vessel density from aisstream cache near origin/destination ports
- 🚚 **Road Traffic** — Google Maps Routes API for trucking leg ETA delta
- 🌐 **Geopolitical** — NewsData.io news aggregation + Gemini NLP classification for strikes/customs/conflicts

**Composite Score:**
```
Shipment Risk = weighted_avg(leg_scores) × SLA_urgency_multiplier
```

SLA urgency multiplier scales from 1.0x (>72hrs) to 2.5x (<24hrs).

**Output:**
- `GET /api/v1/risk-scores` — All shipments with live scores
- `GET /api/v1/risk-scores/:id` — Single shipment detail with per-leg breakdown
- `POST /api/v1/risk-scores/refresh/:id` — Manual refresh trigger

**Scheduler:** Runs every 15 minutes automatically via Node.js scheduler.

</details>

<details>
<summary><b>2. Cascade Impact Simulator</b></summary>

When a disruption is detected on any shipment, instantly traverses the **dependency graph** (shipments → warehouses → POs → customers) and calculates total financial exposure.

**Algorithm:** BFS traversal with depth limit of 5 hops.

**Impact Scoring:**
```
Per-node impact = delay_propagation_likelihood × business_impact_magnitude
Total exposure = sum of downstream customer SLA penalties
```

**Example:**
```
Shipment X delayed 18hrs
  → Misses consolidation at Hamburg (closes in 12hrs)
    → 4 co-loaded shipments affected
      → Warehouse Y receives partial order
        → PO #4421 cannot be fulfilled
          → Customer SLA breach
            → $180K penalty exposure
```

**Output:**
- `POST /api/v1/cascade/:shipmentId` — Impact report
- Returns: affected shipments, total exposure (USD), cascade path, criticality ranking

**Latency:** < 5 seconds per cascade run.

</details>

<details>
<summary><b>3. Autonomous Decision Engine</b></summary>

Generates 3 ranked reroute options and autonomously executes decisions within pre-approved thresholds.

**Pipeline:**

1. **ML Prediction** (XGBoost):
   - Predicts P(SLA_breach) based on carrier, lane, season, disruption severity
   - Trained on synthetic 5k-row dataset; ROC-AUC 0.985
   - TypeScript tree-walker evaluates model at runtime

2. **Deterministic Option Generation**:
   - **Safe**: Switch carrier (alt carrier lookup, rate tables), saves ~60% delay, SLA met
   - **Aggressive**: Air freight, 24h ahead of original schedule, highest cost
   - **Defer**: Hold + monitor, cheapest, SLA at risk (shown as warning)

3. **Expected-Loss Ranking** (actuarial framework):
   ```
   E[loss] = direct_cost
           + P(SLA_breach|option) × penalty_per_day × breach_days
           + cascade_exposure × P(cascade_materializes|option)
   ```

4. **Gemini Rationale** (text-only):
   - Single sentence explanation per option
   - No decision-making by LLM; only narrative generation

5. **Auto-Execute Rule**:
   ```
   IF option != 'Defer'
   AND sla_outcome == 'met'
   AND cost_delta < $50k
   AND confidence > 80%
   THEN auto_execute() + notify_slack()
   ```

**Output:**
- `POST /api/v1/decisions/:shipmentId` — Generate decision
- Returns: 3 ranked DecisionOption objects with expected loss breakdown
- `PATCH /api/v1/decisions/:id/approve` — Manager approval
- `PATCH /api/v1/decisions/:id/reject` — Manager rejection

**Latency:** < 3 seconds per decision.

**Decision Option Schema:**
```typescript
{
  option_id: string;
  label: 'Safe' | 'Aggressive' | 'Defer';
  action: 'switch_carrier' | 'air_freight' | 'hold';
  cost_delta_usd: number;
  eta_delta_hours: number;
  sla_outcome: 'met' | 'at_risk' | 'missed';
  confidence_score: number; // 0.0–1.0
  expected_loss_usd: number;
  expected_loss_breakdown: {
    direct_cost: number;
    sla_penalty: number;
    cascade_exposure: number;
  };
  rationale: string; // One sentence from Gemini
  auto_executable: boolean;
}
```

</details>

<details>
<summary><b>4. Real-Time Events & Notifications</b></summary>

Live event streaming via Server-Sent Events (SSE) and Slack Block Kit webhooks.

**SSE Endpoint:**
```
GET /api/v1/events

Response stream:
data: {type: 'shipment_updated', shipment_id: 'SH-4821', risk_score: 87, ...}
data: {type: 'decision_queued', decision_id: 'DEC-0001', shipment_id: 'SH-4821', ...}
```

Features:
- Snapshot of all shipments + decisions on connect
- Pushes live updates every 15 minutes (risk recalculation)
- 30-second keepalive to prevent connection drop
- Frontend subscribes once, receives all updates

**Slack Webhooks:**

Triggered on auto-executed decisions with Block Kit formatting:
```
⚡ Auto-Rerouted: SH-4821
Carrier: Maersk → Hapag-Lloyd
SLA: ✅ Met (12h buffer)
Cost Impact: +$320
Expected Loss Reduction: -$44K
```

Includes:
- Decision ID (clickable to audit trail)
- Shipment + customer context
- Cost delta + SLA outcome
- Expected loss figures

</details>

---

## System Architecture

![System Architecture](./5.%20Flow%20Diagram.svg)

### Data Flow: Signal → Disruption → Decision → Action

```
1. Signal Arrival (e.g., weather event via Tomorrow.io)
   ↓
2. Risk Engine processes 18 affected shipments
   ├─ Recomputes per-leg risk scores
   ├─ Updates shipment composite & weighted scores
   └─ Checks threshold breach (>75)
   ↓
3. Threshold breach → Cascade Simulator triggered
   ├─ BFS traversal of dependency graph
   ├─ Identifies 11 downstream shipments
   └─ Calculates total SLA exposure: $340K
   ↓
4. Decision Engine
   ├─ ML predicts P(SLA_breach) = 0.18
   ├─ Generates 3 options + expected loss ranking
   ├─ Evaluates auto-execute rules
   └─ 4 qualify → auto-execute, 2 require approval
   ↓
5. Execution
   ├─ Auto-execute: Dispatch carrier API call, update store
   ├─ Notify: Slack webhook with Block Kit
   └─ Approval queue: Push cards to manager UI
```

---

## Technical Stack

| Component             | Technology                  | Purpose                                   |
| --------------------- | --------------------------- | ----------------------------------------- |
| **Backend**           | Node.js + Express + TypeScript | REST API, orchestration, business logic   |
| **Scheduling**        | Node.js setInterval         | 15-min risk engine trigger, event emit    |
| **ML**                | XGBoost (Python) + TypeScript | Breach prediction model + inference       |
| **AI**                | Gemini 2.5 Flash API        | Rationale generation (text-only)          |
| **Signal Ingestion**  | Tomorrow.io, aisstream, Maps, NewsData | External APIs                |
| **Data Store**        | In-memory (JSON + JS objects) | Shipments, decisions, dependency graph    |
| **Real-Time**         | Server-Sent Events (SSE)    | Live UI updates from backend              |
| **Notifications**     | Slack Webhooks + Block Kit  | Auto-execute alerts                       |
| **Frontend** (PRD)    | React + TypeScript          | Decision approval, risk dashboard         |

---

## Project Structure

```
pigeon/
├── backend/
│   ├── src/
│   │   ├── index.ts                   # Express app entry point
│   │   ├── config.ts                  # API keys, env config
│   │   ├── store/
│   │   │   └── index.ts               # In-memory data store
│   │   ├── types/
│   │   │   ├── shipment.ts
│   │   │   ├── decision.ts
│   │   │   ├── cascade.ts
│   │   │   └── ...
│   │   ├── modules/
│   │   │   ├── risk-engine/           # 5-signal scorer
│   │   │   │   ├── signals/           # Individual signal fetchers
│   │   │   │   ├── scorer.ts
│   │   │   │   ├── scheduler.ts
│   │   │   │   └── index.ts
│   │   │   ├── cascade-simulator/     # BFS + exposure calc
│   │   │   │   ├── graph-traversal.ts
│   │   │   │   ├── exposure.ts
│   │   │   │   └── index.ts
│   │   │   ├── decision-engine/       # ML + options + ranker
│   │   │   │   ├── predictor.ts       # XGBoost tree-walker
│   │   │   │   ├── options.ts         # Deterministic generation
│   │   │   │   ├── expected-loss.ts   # Ranker + auto-execute rule
│   │   │   │   ├── gemini.ts          # Rationale generation
│   │   │   │   └── index.ts           # Orchestrator
│   │   │   └── notifications/
│   │   │       └── slack.ts           # Slack webhook
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── shipments.ts
│   │   │   ├── risk-scores.ts
│   │   │   ├── cascade.ts
│   │   │   ├── decisions.ts
│   │   │   └── events.ts              # SSE endpoint
│   │   └── data/
│   │       ├── shipments.json
│   │       ├── customers.json
│   │       ├── dependency-graph.json
│   │       └── index.ts
│   ├── ml/
│   │   ├── generate_data.py           # Synthetic dataset (5k rows)
│   │   ├── train.py                   # XGBoost training
│   │   └── model.json                 # Exported model
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── docs/
│   ├── system-design.md               # Full technical design
│   └── frontend-prd.md                # Frontend spec + wireframes
├── conductor/
│   ├── tracks/                        # Implementation tracks (TRK-001 to TRK-005)
│   ├── product.md
│   ├── tech-stack.md
│   └── workflow.md
└── README.md (this file)
```

---

## Quick API Reference

### Risk Scores

```bash
# Get all shipments with current risk scores
GET /api/v1/risk-scores

# Get single shipment with per-leg breakdown
GET /api/v1/risk-scores/:shipmentId

# Manual refresh (triggers full signal ingestion)
POST /api/v1/risk-scores/refresh/:shipmentId
POST /api/v1/risk-scores/refresh  # All shipments
```

### Cascade Simulator

```bash
# Simulate cascade impact from disrupted shipment
POST /api/v1/cascade/:shipmentId

Response:
{
  "trigger_shipment": "SH-4821",
  "affected_shipments": ["SH-4830", "SH-4831"],
  "total_sla_exposure_usd": 340000,
  "cascade_path": [...]
}
```

### Decision Engine

```bash
# Generate decision for disrupted shipment
POST /api/v1/decisions/:shipmentId

Response:
{
  "decision_id": "DEC-0001",
  "status": "auto_executed | pending_approval",
  "options": [
    {
      "label": "Safe",
      "cost_delta_usd": 800,
      "sla_outcome": "met",
      "expected_loss_usd": 1200,
      "auto_executable": true,
      ...
    }
  ],
  "selected_option_id": "opt-safe",  // If auto-executed
  "resolved_by": "auto"
}

# Approve decision
PATCH /api/v1/decisions/:decisionId/approve
Body: { option_id: "opt-safe" }

# Reject decision
PATCH /api/v1/decisions/:decisionId/reject
Body: { reason: "..." }
```

### Real-Time Events

```bash
# Subscribe to live updates (Server-Sent Events)
GET /api/v1/events

# Event types:
# - shipment_updated: Risk score changed
# - decision_queued: New decision needs approval
# - decision_executed: Decision auto-executed
# - cascade_computed: Cascade impact calculated
```

---

## Configuration

Create `backend/.env`:

```env
# Tomorrow.io (weather)
TOMORROW_IO_API_KEY=your_key_here

# aisstream.io (vessel tracking + port congestion)
AISSTREAM_WEBSOCKET_URL=wss://stream.aisstream.io/v0/stream

# Google Maps (traffic/routing)
GOOGLE_MAPS_API_KEY=your_key_here

# NewsData.io (geopolitical)
NEWSDATA_API_KEY=your_key_here

# Gemini (decision rationale)
GEMINI_API_KEY=your_key_here

# Slack (notifications)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Server
PORT=3000
NODE_ENV=development
```

---

## Running the Backend

```bash
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development (with hot reload)
npm run dev

# Run in production
npm run start
```

Backend logs:
- Risk engine: `[risk-engine] Refreshed 40 shipments (18 high-risk)`
- Cascade: `[cascade] Computed impact for SH-4821: 11 downstream, $340K exposure`
- Decisions: `[decision-engine] Auto-executed DEC-0001 for SH-4821`
- Events: `[events] Connected 1 client, 234 clients total`

---

## Testing

<details>
<summary><b>Manual Testing Flow</b></summary>

1. **Start backend:**
   ```bash
   cd backend && npm run dev
   ```

2. **Check baseline (all shipments low risk):**
   ```bash
   curl http://localhost:3000/api/v1/risk-scores
   ```

3. **Trigger disruption (e.g., on SH-4821):**
   ```bash
   # Call manual refresh to pick up new signals
   # (In real system, happens every 15min automatically)
   curl -X POST http://localhost:3000/api/v1/risk-scores/refresh/SH-4821
   ```

4. **Check cascade impact:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/cascade/SH-4821
   ```

5. **Generate decision:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/decisions/SH-4821
   ```

6. **Monitor events (in separate terminal):**
   ```bash
   curl http://localhost:3000/api/v1/events
   ```

7. **Approve or reject decision:**
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/decisions/DEC-0001/approve \
     -H "Content-Type: application/json" \
     -d '{"option_id": "opt-safe"}'
   ```

8. **Check Slack** for auto-execute notification (if triggered)

</details>

---

## Demo Scenario

**Setup:** 40 synthetic shipments across 8 global lanes. Typhoon in South China Sea.

**Timeline:**

```
T+0 min    🌪️ Typhoon warning issued for South China Sea
T+0 min    ↓ Risk Engine picks up weather signal
T+1 min    ⚠️ 18 shipments flagged, scores spike (avg 85)
T+2 min    📊 Cascade Simulator runs: $1.2M SLA exposure
T+3 min    🤖 Decision Engine evaluates all 18 shipments
T+3 min    ✅ 4 shipments auto-execute (SLA met, cost<$50k)
T+3 min    📱 Slack notifications sent to managers
T+4 min    ⏳ 2 shipments queued for manager approval
T+10 min   👨‍💼 Manager wakes up, reviews 2 cards
T+11 min   ✔️ Manager approves both
T+11 min   ✅ All 18 shipments resolved, SLAs protected
```

**Total resolution time: 11 minutes** (vs. 4+ hours with manual process)

---

## Implementation Status

✅ **Phase 1 — Foundation** (TRK-001)
- Express/TS scaffold, data models, 40-shipment seed data

✅ **Phase 2 — Risk Engine** (TRK-002)
- 5 signals: weather, vessel, port, traffic, geopolitical
- Per-leg scoring + composite calculation
- 15-min scheduler + manual refresh routes

✅ **Phase 3 — Cascade Simulator** (TRK-003)
- BFS dependency graph traversal
- Dollar-quantified SLA exposure calculation
- API endpoints + response formatting

✅ **Phase 4 — Decision Engine** (TRK-004)
- XGBoost ML breach predictor
- Deterministic option generator (rate tables, SLA math)
- Expected-loss ranking + auto-execute rule engine
- Gemini rationale generation (text-only)

✅ **Phase 5 — Real-Time + Notifications** (TRK-005)
- SSE `/api/v1/events` with snapshot-on-connect
- Slack Block Kit webhooks for auto-executions

⏳ **Frontend PRD** (In progress)
- API mapping, wireframes, decision card UI
- TypeScript types + SSE client handler

---

## Key Decisions

### Why ML for breach prediction, not LLM for decisions?

XGBoost is fast (< 1ms inference), reliable, and trained on historical data. Gemini is only used for narrative generation (one sentence per option), where hallucination is safe. Decision-making is deterministic (expected-loss ranking) — no subjective judgment from the LLM.

### Why in-memory store in v1?

Fast iteration during development. Production would use:
- PostgreSQL for relational data (shipments, decisions, dependency graph)
- Firestore for real-time UI state sync
- BigQuery for historical analytics

### Why aisstream instead of VesselFinder?

aisstream provides both real-time AIS data (vessel positions) AND historical vessel density near ports (from cached data). This eliminates one paid dependency while keeping port congestion signals.

### Why Slack webhooks instead of email?

Mobile-first notifications. Slack delivers in <1sec, supports interactive Block Kit buttons, and integrates with existing ops workflows. Email is too slow for autonomous execution notifications.

---

## Support & Contribution

**Issues?** Check logs in `backend/` terminal.

**Questions?** Refer to:
- Architecture deep-dive: `docs/system-design.md`
- API contracts: `docs/frontend-prd.md`
- Feature specs: Conductor tracks in `conductor/tracks/`

**Want to contribute?** Open a PR on `feat/backend-architecture` branch.

---

## License

Built for Google Solution Challenge 2025. Code available under MIT License.

**Made by:** Sumeet Gond & team  
**Date:** May 2025
