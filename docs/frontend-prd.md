# Pigeon — Frontend PRD
### For the Frontend Team · Google Solution Challenge 2026

---

## 1. What You're Building

A **supply chain war room** called the Command Center. A logistics manager opens this at 2 AM, sees 18 shipments just went red because of a typhoon, watches 4 of them auto-resolve in real time, and approves the remaining 2 in one tap.

That's the whole UX story. Everything on screen must serve that moment.

**Stack:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand for client state.

### How the decision engine works (so you can pitch the demo correctly)

The decision engine is the most differentiated piece of this product. Understand it before you build the UI:

```
Live signals (weather, vessel, port, traffic, geopolitical)
       ↓
[XGBoost classifier]  →  P(SLA breach) — real ML prediction, not Gemini opinion
       ↓
[Option generator]  →  3 deterministic options (rate tables + SLA math)
       ↓
[Expected loss ranker]  →  picks the winner by minimizing:
                          cost + P(breach) × penalty × days + cascade × P(cascade)
       ↓
[Gemini]  →  writes ONE sentence per option explaining the numbers
```

**The numbers are real.** `cost_delta_usd` comes from a carrier rate table. `breach_probability` comes from a trained model. `expected_loss_usd` comes from financial math. Gemini's only job is the rationale text.

This means the UI should foreground:
- **Expected loss** as the headline number (not cost_delta)
- **ML breach probability** as a separate, prominent stat
- **Loss breakdown** (direct cost + SLA penalty + cascade exposure) so the manager sees WHY the number is what it is

---

## 2. Pages (3 total)

| Route | Name | Purpose |
|---|---|---|
| `/` | Command Center | Main dashboard — shipment list, risk scores, live feed |
| `/shipments/:id` | Shipment Detail | Per-leg breakdown, cascade report, decision card |
| `/decisions` | Approval Queue | All pending decisions, approve/reject |

That's it. No more pages for the hackathon. Everything else is a panel or modal on these 3.

---

## 3. Backend API Reference

Base URL: `http://localhost:3000/api/v1`

---

### 3.1 Health

```
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "shipmentCount": 40,
    "activeDisruptions": 2
  }
}
```

Use on app load to verify backend is up.

---

### 3.2 Shipments

```
GET /shipments
```

**Query params:**
- `status` — filter by `in_transit | delayed | at_port | delivered`
- `minRisk` — filter by minimum `weighted_risk_score` (e.g. `75`)
- `limit` / `offset` — pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "shipment_id": "SH-4800",
      "status": "in_transit",
      "origin": { "port": "CNSHA", "country": "CN" },
      "destination": { "port": "NLRTM", "country": "NL" },
      "carrier": "Maersk",
      "SLA_deadline": "2026-05-18T18:00:00Z",
      "customer_id": "CUST-001",
      "purchase_orders": ["PO-7001", "PO-7002"],
      "legs": [
        { "leg_id": "L1", "type": "trucking", "risk_score": 20 },
        { "leg_id": "L2", "type": "port", "risk_score": 18 },
        { "leg_id": "L3", "type": "ocean", "risk_score": 34 },
        { "leg_id": "L4", "type": "port", "risk_score": 66 },
        { "leg_id": "L5", "type": "trucking", "risk_score": 20 }
      ],
      "composite_risk_score": 32,
      "sla_urgency_multiplier": 1,
      "weighted_risk_score": 32
    }
  ]
}
```

```
GET /shipments/:id
```

Same shape, single shipment object.

---

### 3.3 Risk Scores

```
GET /risk-scores
```

Returns all 40 shipments with their current scores. Lighter than `/shipments` — use this for the leaderboard.

**Response:** same array shape as `/shipments`

```
GET /risk-scores/:id
```

Single shipment risk score.

```
POST /risk-scores/refresh/:id
```

Triggers a live re-score of one shipment from all signal sources. Returns the updated shipment. Call this when the user manually hits "Refresh" on a shipment card.

```
POST /risk-scores/refresh
```

Refreshes ALL 40 shipments. Takes ~10–15 seconds. Show a loading state.

---

### 3.4 Cascade Simulator

```
POST /cascade/simulate
```

**Body:**
```json
{ "shipmentId": "SH-4800", "delayHours": 18 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trigger_shipment": "SH-4800",
    "affected_shipments": ["SH-4810"],
    "affected_purchase_orders": ["PO-7015", "PO-7016"],
    "affected_customers": ["CUST-010"],
    "total_sla_exposure_usd": 229167,
    "critical_path": ["SH-4800", "SH-4810"],
    "cascade_nodes": [
      {
        "shipment_id": "SH-4810",
        "delay_hours": 18,
        "sla_breached": true,
        "sla_exposure_usd": 229167,
        "hop_depth": 1
      }
    ],
    "computed_at": "2026-05-13T06:23:02.607Z"
  }
}
```

Call when user opens a shipment detail and you want to show cascade impact. Can also use the "what-if delay" slider.

```
GET /cascade/graph
```

Returns the full dependency adjacency list. Use to render the graph visualization.

**Response:**
```json
{
  "success": true,
  "data": {
    "SH-4800": ["SH-4810"],
    "SH-4808": ["SH-4809"],
    ...
  }
}
```

---

### 3.5 Decisions

**How the engine works (so you can build the UI right):**

1. An **XGBoost classifier** predicts `breach_probability` (0–1) from live signal data
2. **Three options** are generated deterministically (rate tables, SLA math, no AI)
3. **Expected loss** is computed per option: `direct_cost + P(breach) × penalty × breach_days + cascade_exposure × P(cascade)`
4. **Options are returned in expected-loss order** (lowest first = recommendation)
5. **Auto-execute** fires for the cheapest SLA-met intervention that beats Defer; otherwise queue for human
6. **Gemini writes only the rationale text** — the numbers are all real

```
POST /decisions/generate
```

**Body:**
```json
{ "shipmentId": "SH-4801" }
```

**Response (auto-executed):**
```json
{
  "success": true,
  "data": {
    "decision_id": "DEC-0001",
    "shipment_id": "SH-4801",
    "trigger_event_id": "risk-threshold-1778653636043",
    "status": "auto_executed",
    "created_at": "2026-05-13T09:30:00Z",
    "resolved_at": "2026-05-13T09:30:00Z",
    "resolved_by": "auto",
    "selected_option_id": "opt-safe",

    "delay_prediction": {
      "breach_probability": 0.926,
      "breach_likely": true
    },
    "estimated_delay_hours": 58,
    "cascade_exposure_usd": 0,

    "options": [
      {
        "option_id": "opt-safe",
        "label": "Safe",
        "action": "switch_carrier",
        "carrier": "Hapag-Lloyd",
        "cost_delta_usd": 3000,
        "eta_delta_hours": 23,
        "sla_outcome": "met",
        "breach_hours": 0,
        "confidence_score": 0.83,
        "expected_loss_usd": 3000,
        "expected_loss_breakdown": {
          "direct_cost": 3000,
          "sla_penalty": 0,
          "cascade_exposure": 0
        },
        "rationale": "The $3,000 expected loss is solely from a direct cost, as the 23-hour delay still meets the SLA, avoiding penalties.",
        "auto_executable": true
      },
      {
        "option_id": "opt-defer",
        "label": "Defer",
        "action": "hold",
        "cost_delta_usd": 0,
        "eta_delta_hours": 58,
        "sla_outcome": "missed",
        "breach_hours": 28,
        "confidence_score": 0.42,
        "expected_loss_usd": 23767,
        "expected_loss_breakdown": {
          "direct_cost": 0,
          "sla_penalty": 23767,
          "cascade_exposure": 0
        },
        "rationale": "The $23,767 expected loss results entirely from SLA penalties because the 58-hour delay misses the deadline without incurring direct costs.",
        "auto_executable": false
      },
      {
        "option_id": "opt-aggressive",
        "label": "Aggressive",
        "action": "air_freight",
        "cost_delta_usd": 39550,
        "eta_delta_hours": -24,
        "sla_outcome": "met",
        "breach_hours": 0,
        "confidence_score": 0.83,
        "expected_loss_usd": 39550,
        "expected_loss_breakdown": {
          "direct_cost": 39550,
          "sla_penalty": 0,
          "cascade_exposure": 0
        },
        "rationale": "The $39,550 expected loss is a direct cost for air freight, ensuring the SLA is met with a 24-hour early arrival and no penalties.",
        "auto_executable": true
      }
    ]
  }
}
```

**New top-level fields (not on individual options):**

| Field | Meaning | UI Use |
|---|---|---|
| `delay_prediction.breach_probability` | ML model output: P(SLA breach) | Show prominently as "ML risk: 93%" |
| `delay_prediction.breach_likely` | `breach_probability > 0.5` | Color flag (red if true) |
| `estimated_delay_hours` | Disruption-induced delay assumed by the engine | "Engine assumed: 58h disruption" |
| `cascade_exposure_usd` | Total downstream $ at risk if no action | "Cascade at risk: $X" — same number as cascade report |

**New per-option fields:**

| Field | Meaning | UI Use |
|---|---|---|
| `expected_loss_usd` | Total expected financial loss for this option | **The headline number per option** — bigger than cost_delta |
| `expected_loss_breakdown.direct_cost` | Cost you'd pay to execute | Stack chart segment |
| `expected_loss_breakdown.sla_penalty` | Probability-weighted SLA penalty | Stack chart segment |
| `expected_loss_breakdown.cascade_exposure` | Probability-weighted cascade $ | Stack chart segment |
| `breach_hours` | How many hours past SLA this option arrives (0 = met) | Show as `+9h past SLA` if > 0 |

**Important — options come pre-ranked by expected loss:**

The array order IS the recommendation order. `options[0]` is the lowest expected loss = the engine's pick. Don't re-sort in the UI unless you provide a clear "sort by..." control.

When `status === "auto_executed"`, the option matching `selected_option_id` may NOT be `options[0]` — auto-execute picks the cheapest SLA-met intervention, which could be position 0, 1, or 2.

**Status values:**
- `auto_executed` — Pigeon already acted. Show "Auto-executed by Pigeon ⚡" banner, highlight `selected_option_id`
- `pending_approval` — Show all 3 options, manager picks one
- `approved` — Manager-approved (after pending_approval)
- `overridden` — Manager rejected all options

```
GET /decisions
```

Returns all `status: "pending_approval"` decisions. Use SSE for live updates.

```
POST /decisions/:id/approve
```

**Body:** `{ "optionId": "opt-safe" }`

```
POST /decisions/:id/reject
```

No body. Marks status as `overridden`.

```
GET /decisions/audit
```

Returns all auto-executed, approved, and overridden decisions. Use for the audit log / "Resolved Today" section.

---

### 3.6 Real-time SSE Stream

```
GET /events
```

Connect once on app load. Keep alive. This is how the UI stays live.

**How to connect (React):**
```typescript
useEffect(() => {
  const es = new EventSource('http://localhost:3000/api/v1/events');
  es.onmessage = (e) => {
    const event = JSON.parse(e.data);
    // dispatch to Zustand based on event.type
  };
  return () => es.close();
}, []);
```

**Event types you'll receive:**

| `type` | When | Payload |
|---|---|---|
| `snapshot` | On connect | All 40 shipments with current scores |
| `risk_update` | Every refresh | `{ shipment_id, composite_risk_score, weighted_risk_score }` |
| `disruption` | When risk > 75 | Full `DisruptionEvent` object |
| `cascade_report` | After BFS runs | Full `CascadeImpactReport` |
| `decision_pending` | New pending decision | Full `DecisionRecord` |
| `decision_auto_executed` | Auto-execute fires | Full `DecisionRecord` with `resolved_by: "auto"` |

---

## 4. UI Design

### 4.1 Color System

Risk score → color is the core visual language. Use it consistently everywhere.

| Score Range | Label | Color | Tailwind |
|---|---|---|---|
| 0–39 | Low | Green | `text-emerald-400 bg-emerald-400/10` |
| 40–69 | Medium | Amber | `text-amber-400 bg-amber-400/10` |
| 70–100 | Critical | Red | `text-red-400 bg-red-400/10` |

SLA outcome colors:
- `met` → green
- `at_risk` → amber
- `missed` → red

Decision label colors:
- `Safe` → emerald
- `Aggressive` → blue
- `Defer` → slate (with amber warning)

**Overall theme:** Dark background. This is a war room, not a consumer app. Use `bg-gray-950` or `bg-slate-900` as the base. White/gray text. Risk colors pop.

---

### 4.2 Page 1 — Command Center (`/`)

This is the hero screen. Judge spends most time here.

**Layout:** Full-height, two-column.
- Left column (60%): Shipment risk leaderboard
- Right column (40%): Live event feed + stats

```
┌─────────────────────────────────────────────────────────┐
│  🐦 PIGEON           [● LIVE]    40 shipments  2 alerts  │
├──────────────────────────────┬──────────────────────────┤
│                              │  STATS BAR               │
│  SHIPMENT RISK LEADERBOARD   │  Critical: 10            │
│  ─────────────────────────── │  Amber: 15               │
│  Sorted by weighted score ↓  │  Green: 15               │
│                              │  SLA Exposure: $1.2M     │
│  [SH-4803] CNSHA→NLRTM  98  │                          │
│  [SH-4808] CNSHA→DEHAM  95  │──────────────────────────│
│  [SH-4801] CNSHA→NLRTM  92  │  PENDING APPROVALS  (2)  │
│  [SH-4809] CNSHA→DEHAM  89  │  ┌──────────────────┐   │
│  [SH-4800] CNSHA→NLRTM  87  │  │ SH-4803  DEC-001 │   │
│  ...                         │  │ [Approve][Reject] │   │
│                              │  └──────────────────┘   │
│                              │                          │
│                              │  LIVE EVENT FEED         │
│                              │  ● Auto-executed SH-4800 │
│                              │  ● Risk spike: SH-4803   │
│                              │  ● Cascade: $229K exposed│
└──────────────────────────────┴──────────────────────────┘
```

**Shipment row (leaderboard):**
- Shipment ID (monospace)
- Origin port → Destination port (e.g. `CNSHA → NLRTM`)
- Carrier name
- `weighted_risk_score` as a large badge (color-coded)
- SLA deadline relative (e.g. `5d 12h`)
- Small leg sparkline (5 colored dots for L1–L5)
- Click → navigate to `/shipments/:id`

**Stats bar (top of right column):**
- Count of Critical / Amber / Green shipments
- Total SLA exposure in USD
- Active disruptions count
- These update live from SSE

**Pending Approvals section:**
- Compact cards, max 3 visible, scroll for more
- Each shows: shipment ID, decision ID, recommended option label
- `[Approve recommended]` button (calls POST /decisions/:id/approve with highest-confidence option)
- `[View]` → opens decision detail modal

**Live Event Feed:**
- Chronological, newest on top
- Color-coded dots per event type
- Max 20 items, older ones drop off
- Powered by SSE stream

---

### 4.3 Page 2 — Shipment Detail (`/shipments/:id`)

**Layout:** Single wide column, sections stacked.

```
┌──────────────────────────────────────────────────────────┐
│  ← Back   SH-4800                          [↻ Refresh]  │
│  Maersk · CNSHA → NLRTM · SLA: May 18, 18:00 UTC       │
├──────────────────────────────────────────────────────────┤
│  WEIGHTED RISK SCORE                                     │
│                                                          │
│       ████████████████░░░░░  87 / 100  CRITICAL         │
│                                                          │
│  LEGS BREAKDOWN                                          │
│  L1  trucking   [██░░░░]  20  Shanghai Factory → CNSHA  │
│  L2  port       [███░░░]  25  CNSHA                     │
│  L3  ocean      [████░░]  39  CNSHA → NLRTM             │
│  L4  port       [████████] 74  NLRTM              ⚠     │
│  L5  trucking   [██░░░░]  20  NLRTM → Amsterdam WH      │
├──────────────────────────────────────────────────────────┤
│  CASCADE IMPACT                      [Simulate Delay ▾] │
│  Trigger: 18h delay                                      │
│  Affected: 1 shipment · 2 POs · 1 customer              │
│  SLA Exposure: $229,167                                  │
│  Critical path: SH-4800 → SH-4810                       │
│                                                          │
│  SH-4810  hop 1  18h delay  SLA breached  $229,167      │
├──────────────────────────────────────────────────────────┤
│  DECISION ENGINE           [Generate Options with AI]   │
│                                                          │
│  [Decision card shown here if generated]                │
└──────────────────────────────────────────────────────────┘
```

**Leg breakdown bar:** Each leg is a horizontal bar (0–100). Color matches risk level. Icon per leg type (🚛 trucking, ⚓ port, 🚢 ocean). Warning icon on legs > 70.

**Cascade section:**
- Shows inline after page load — call `POST /cascade/simulate` with `delayHours: 18` automatically
- "Simulate Delay" dropdown: 6h / 12h / 18h / 24h / 48h — re-calls simulate on change
- Cascade nodes listed as a table: shipment ID, hop depth, delay hours, SLA breached (✓/✗), exposure

**Decision section:**
- Initially shows `[Generate Options with AI]` button
- On click: POST /decisions/generate, show loading skeleton
- Render the returned decision card (see 4.4 below)
- If `status === "auto_executed"`, show a green "Auto-executed by Pigeon" banner with the selected option highlighted

---

### 4.4 Decision Card Component

Used on both the shipment detail page and the approval queue. Reuse the same component.

**This is the most data-dense component in the app.** It must convey:
- The ML model's prediction
- Three options, ranked by expected loss
- For each: what it costs, what it saves, and WHY it's ranked where it is

**Header strip** (above the 3 option columns):

```
┌──────────────────────────────────────────────────────────────────┐
│ AI DECISION · DEC-0001 · SH-4801 · Auto-executed by Pigeon ⚡   │
│                                                                  │
│ ML Prediction: P(breach) = 92.6%  [▰▰▰▰▰▰▰▰▰░] BREACH LIKELY   │
│ Engine assumed 58h disruption · Cascade exposure: $0            │
│ Recommendation ranked by minimum expected loss                  │
└──────────────────────────────────────────────────────────────────┘
```

Show `delay_prediction.breach_probability` as a percentage with a horizontal meter. Use color: red if > 0.7, amber 0.4–0.7, green < 0.4.

**Three option columns** — order matches `options[]` array (already ranked by expected loss):

```
┌──────────────────┬──────────────────┬─────────────────────┐
│  ① SAFE      ⚡  │  ② DEFER         │  ③ AGGRESSIVE       │
│  switch_carrier  │  hold            │  air_freight        │
│  via Hapag-Lloyd │                  │                     │
│ ──────────────── │ ──────────────── │ ─────────────────── │
│                  │                  │                     │
│  EXPECTED LOSS   │  EXPECTED LOSS   │  EXPECTED LOSS      │
│   $3,000         │   $23,767        │   $39,550           │
│                  │                  │                     │
│  ▰▱▱  cost       │  ▱▱▱  cost       │  ▰▰▰  cost          │
│  ▱▱▱  penalty    │  ▰▰▰  penalty    │  ▱▱▱  penalty       │
│  ▱▱▱  cascade    │  ▱▱▱  cascade    │  ▱▱▱  cascade       │
│                  │                  │                     │
│  Direct cost:    │  Direct cost:    │  Direct cost:       │
│   $3,000         │   $0             │   $39,550           │
│  SLA penalty:    │  SLA penalty:    │  SLA penalty:       │
│   $0             │   $23,767        │   $0                │
│  Cascade exp:    │  Cascade exp:    │  Cascade exp:       │
│   $0             │   $0             │   $0                │
│                  │                  │                     │
│  ETA: +23h late  │  ETA: +58h late  │  ETA: -24h early    │
│  SLA: met ✓      │  SLA: missed ✗   │  SLA: met ✓         │
│  Breach: 0h      │  Breach: 28h     │  Breach: 0h         │
│  Confidence: 83% │  Confidence: 42% │  Confidence: 83%    │
│                  │                  │                     │
│  "The $3,000     │  "The $23,767    │  "The $39,550       │
│  expected loss   │  expected loss   │  expected loss is   │
│  is solely from  │  results entirely│  a direct cost for  │
│  direct cost..." │  from SLA pen..."│  air freight..."    │
│                  │                  │                     │
│  ⚡ PIGEON CHOSE │   [Approve]      │   [Approve]         │
│     THIS         │                  │                     │
└──────────────────┴──────────────────┴─────────────────────┘
                                          [Reject All]
```

**Rendering rules:**

- **Column order** = options array order (don't re-sort). Number them ①②③.
- **Expected loss is the headline number per option** — render large (text-2xl+), color-coded:
  - Lowest in the row: green
  - Middle: amber
  - Highest: red
- **Stack bars** show the breakdown components (direct_cost, sla_penalty, cascade_exposure) as relative widths. This makes it instantly visible WHY the loss is what it is.
- **⚡ icon on the option header** if `auto_executable: true`
- **"⚡ PIGEON CHOSE THIS"** badge replaces `[Approve]` for the option matching `selected_option_id` when `status === "auto_executed"`. Other options stay visible but greyed.
- **`[Approve]` button** per option → POST `/decisions/:id/approve` with that `option_id`
- **`[Reject All]`** below the grid → POST `/decisions/:id/reject`

**Color rules per option:**

| Field | Color logic |
|---|---|
| `sla_outcome: met` | emerald icon ✓ |
| `sla_outcome: at_risk` | amber icon ⚠ |
| `sla_outcome: missed` | red icon ✗ |
| `breach_hours = 0` | hide breach line entirely |
| `breach_hours > 0` | show as red text |
| Header background | If `option_id === selected_option_id`: emerald glow; otherwise neutral |

**If `status === "auto_executed"`:**
- Replace `[Approve]` on the chosen option with the "⚡ PIGEON CHOSE THIS" badge
- Dim the other two columns to 60% opacity
- Hide `[Reject All]` (already resolved)
- Show resolved timestamp below header

---

### 4.5 Page 3 — Approval Queue (`/decisions`)

Simple table layout. This is where the manager goes to process everything at once.

```
┌──────────────────────────────────────────────────────────┐
│  APPROVAL QUEUE             2 pending · 8 resolved today │
├──────────────────────────────────────────────────────────┤
│  PENDING                                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │ DEC-0003  SH-4803  CNSHA→NLRTM  risk: 98          │ │
│  │ Recommended: Aggressive (+$47k, -60h, 92% conf)   │ │
│  │ [Approve Recommended]  [Review Options]  [Reject]  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  RESOLVED TODAY                                          │
│  DEC-0001  SH-4800  auto_executed  opt-2  13:27         │
│  DEC-0002  SH-4801  auto_executed  opt-2  13:28         │
└──────────────────────────────────────────────────────────┘
```

- `[Approve Recommended]` → one-tap approve with highest-confidence option
- `[Review Options]` → expands the full decision card inline
- Resolved section pulls from `GET /decisions/audit`

---

## 5. Real-time State Management

Use Zustand. One store, three slices.

```typescript
interface PigeonStore {
  // Shipments
  shipments: Map<string, Shipment>;
  setShipments: (s: Shipment[]) => void;
  updateShipmentScore: (id: string, composite: number, weighted: number) => void;

  // Disruptions
  disruptions: DisruptionEvent[];
  addDisruption: (d: DisruptionEvent) => void;

  // Decisions
  pendingDecisions: DecisionRecord[];
  auditLog: DecisionRecord[];
  addDecision: (d: DecisionRecord) => void;
  resolveDecision: (id: string, status: string) => void;

  // Live feed
  eventFeed: FeedItem[];
  pushFeedItem: (item: FeedItem) => void;
}
```

**SSE handler — wire events to store actions:**

```typescript
switch (event.type) {
  case 'snapshot':
    store.setShipments(event.shipments);
    break;
  case 'risk_update':
    store.updateShipmentScore(event.shipment_id, event.composite_risk_score, event.weighted_risk_score);
    store.pushFeedItem({ type: 'risk_update', ...event, at: Date.now() });
    break;
  case 'disruption':
    store.addDisruption(event.event);
    store.pushFeedItem({ type: 'disruption', ...event, at: Date.now() });
    break;
  case 'cascade_report':
    store.pushFeedItem({ type: 'cascade', ...event, at: Date.now() });
    break;
  case 'decision_pending':
    store.addDecision(event.record);
    store.pushFeedItem({ type: 'decision_pending', ...event, at: Date.now() });
    break;
  case 'decision_auto_executed':
    store.addDecision(event.record);
    store.pushFeedItem({ type: 'auto_executed', ...event, at: Date.now() });
    break;
}
```

---

## 6. Key Components to Build

| Component | Used On | Notes |
|---|---|---|
| `<RiskBadge score={n} />` | Everywhere | Colored badge: score + label |
| `<LegBar legs={[...]} />` | Dashboard row, Detail page | 5 colored segment dots |
| `<ShipmentRow />` | Dashboard leaderboard | Full row with all fields |
| `<EventFeed />` | Dashboard right panel | SSE-powered live list |
| `<StatsBar />` | Dashboard right panel | Critical/amber/green counts |
| `<DecisionCard />` | Detail page, Queue | 3-column option card |
| `<CascadeReport />` | Detail page | Impact table + exposure |
| `<PendingApprovalCard />` | Dashboard, Queue | Compact approve card |
| `<LegBreakdown />` | Detail page | Bars with icons per leg |
| `<SseProvider />` | Root layout | Connects SSE, hydrates store |

---

## 7. What NOT to Build (Hackathon Scope)

Skip these — they're in the design doc but not needed for the demo:

- ❌ Google Maps network graph (too much complexity for the time)
- ❌ Supplier comms assistant (Gemini email drafting)
- ❌ Auth / login screen
- ❌ New shipment creation form
- ❌ Mobile app / push notifications
- ❌ Analytics / Looker Studio panel
- ❌ Settings / preferences

The demo is the story. A judge needs to see risk scores spike, cascade impact appear, and a decision get approved in under 2 minutes of screen time.

---

## 8. Demo Flow — What the UI Must Support

This is the exact sequence for the demo. The UI must make this flow feel instant and cinematic.

```
1. Open dashboard → 40 shipments loaded, sorted by risk score
   → Top shipments show red badges (SH-4803: 98, SH-4808: 95...)

2. Open SH-4803 → detail page
   → Leg breakdown shows L4 port at 74 (highlighted)
   → Cascade auto-loads: "1 shipment affected, $229K exposure"

3. Click "Generate Options with AI"
   → 3-second loading skeleton
   → Decision card appears (Safe / Aggressive / Defer)
   → Aggressive option starred (92% confidence)
   → Status shows "Auto-executed by Pigeon ⚡"

4. Back to dashboard → live feed shows auto-execute event
   → Pending approvals panel has 1 card

5. Click "Approve Recommended" on the pending card
   → Card disappears, feed shows "Approved by manager"
   → Shipment risk badge updates live
```

The UI must support this entire flow with **no page reloads, no spinners longer than 3 seconds, and no dead ends.**

---

## 9. Port Code → Display Name Mapping

Use this to show human-readable port names in the UI.

```typescript
export const PORT_NAMES: Record<string, string> = {
  CNSHA: 'Shanghai',
  NLRTM: 'Rotterdam',
  DEHAM: 'Hamburg',
  USLAX: 'Los Angeles',
  GBFXT: 'Felixstowe',
  JPYOK: 'Yokohama',
  SGSIN: 'Singapore',
  INNSA: 'Mumbai',
  KRPUS: 'Busan',
  USNYC: 'New York',
  AUMEL: 'Melbourne',
};
```

---

## 10. TypeScript Types (copy from backend)

These match exactly what the API returns.

```typescript
type LegType = 'trucking' | 'ocean' | 'port' | 'rail' | 'air' | 'last-mile';
type ShipmentStatus = 'pending' | 'in_transit' | 'at_port' | 'delayed' | 'delivered';
type DecisionLabel = 'Safe' | 'Aggressive' | 'Defer';
type DecisionAction = 'switch_carrier' | 'air_freight' | 'hold' | 'reroute';
type DecisionStatus = 'pending_approval' | 'auto_executed' | 'approved' | 'overridden';

interface Leg {
  leg_id: string;
  type: LegType;
  risk_score: number;
  origin?: string;
  destination?: string;
}

interface Shipment {
  shipment_id: string;
  status: ShipmentStatus;
  origin: { port: string; country: string };
  destination: { port: string; country: string };
  carrier: string;
  SLA_deadline: string;
  customer_id: string;
  purchase_orders: string[];
  legs: Leg[];
  composite_risk_score: number;
  sla_urgency_multiplier: number;
  weighted_risk_score: number;
}

interface ExpectedLossBreakdown {
  direct_cost: number;
  sla_penalty: number;
  cascade_exposure: number;
}

interface DecisionOption {
  option_id: string;
  label: DecisionLabel;
  action: DecisionAction;
  carrier?: string;
  cost_delta_usd: number;
  eta_delta_hours: number;
  sla_outcome: 'met' | 'at_risk' | 'missed';
  confidence_score: number;
  rationale: string;
  auto_executable: boolean;

  // NEW — engine output (always present on /decisions/* responses)
  expected_loss_usd?: number;
  expected_loss_breakdown?: ExpectedLossBreakdown;
  breach_hours?: number;
}

interface DelayPredictionSummary {
  breach_probability: number;   // 0.0–1.0 from XGBoost
  breach_likely: boolean;       // breach_probability > 0.5
}

interface DecisionRecord {
  decision_id: string;
  shipment_id: string;
  trigger_event_id: string;
  options: DecisionOption[];
  selected_option_id?: string;
  status: DecisionStatus;
  created_at: string;
  resolved_at?: string;
  resolved_by?: 'auto' | 'manager';

  // NEW — engine context (always present on /decisions/* responses)
  delay_prediction?: DelayPredictionSummary;
  estimated_delay_hours?: number;
  cascade_exposure_usd?: number;
}

interface CascadeNode {
  shipment_id: string;
  delay_hours: number;
  sla_breached: boolean;
  sla_exposure_usd: number;
  hop_depth: number;
}

interface CascadeImpactReport {
  trigger_shipment: string;
  affected_shipments: string[];
  affected_purchase_orders: string[];
  affected_customers: string[];
  total_sla_exposure_usd: number;
  critical_path: string[];
  cascade_nodes: CascadeNode[];
  computed_at: string;
}
```

---

## 11. Helper Functions

```typescript
// Risk score → color class
export function riskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-emerald-400';
}

export function riskBg(score: number): string {
  if (score >= 70) return 'bg-red-400/10 border-red-400/20';
  if (score >= 40) return 'bg-amber-400/10 border-amber-400/20';
  return 'bg-emerald-400/10 border-emerald-400/20';
}

export function riskLabel(score: number): string {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'Elevated';
  return 'Low';
}

// SLA deadline → relative time
export function slaRemaining(deadline: string): string {
  const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 0) return 'BREACHED';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

// SLA urgency level (mirrors backend multiplier)
export function slaUrgency(deadline: string): 'critical' | 'high' | 'medium' | 'normal' {
  const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < 24) return 'critical';
  if (hours < 48) return 'high';
  if (hours < 72) return 'medium';
  return 'normal';
}

// Format USD
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

// ML breach probability → color (matches risk score system but inverted)
export function breachColor(probability: number): string {
  if (probability >= 0.7) return 'text-red-400';
  if (probability >= 0.4) return 'text-amber-400';
  return 'text-emerald-400';
}

export function formatBreachProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

// SLA outcome → icon + color
export function slaOutcomeBadge(outcome: 'met' | 'at_risk' | 'missed') {
  switch (outcome) {
    case 'met':     return { icon: '✓', color: 'text-emerald-400', label: 'SLA met' };
    case 'at_risk': return { icon: '⚠', color: 'text-amber-400', label: 'SLA at risk' };
    case 'missed':  return { icon: '✗', color: 'text-red-400', label: 'SLA missed' };
  }
}

// ETA delta → display string
export function formatEtaDelta(hours: number): string {
  if (hours === 0) return 'on schedule';
  if (hours < 0) return `${Math.abs(hours)}h early`;
  return `${hours}h late`;
}

// Expected loss breakdown → percentages for stacked bar
export function lossBreakdownPercents(breakdown: ExpectedLossBreakdown) {
  const total = breakdown.direct_cost + breakdown.sla_penalty + breakdown.cascade_exposure;
  if (total === 0) return { direct: 0, penalty: 0, cascade: 0 };
  return {
    direct: (breakdown.direct_cost / total) * 100,
    penalty: (breakdown.sla_penalty / total) * 100,
    cascade: (breakdown.cascade_exposure / total) * 100,
  };
}

// Color for an option's expected loss relative to the other options
// Used to highlight the winner green and the worst red
export function rankColor(allLosses: number[], thisLoss: number): string {
  const min = Math.min(...allLosses);
  const max = Math.max(...allLosses);
  if (thisLoss === min) return 'text-emerald-400';
  if (thisLoss === max) return 'text-red-400';
  return 'text-amber-400';
}
```

---

_Pigeon Frontend PRD v1.0 · Backend: `http://localhost:3000/api/v1` · SSE: `GET /api/v1/events`_
