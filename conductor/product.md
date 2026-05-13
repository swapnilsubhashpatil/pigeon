# Product Definition — Pigeon

## Project Name
Pigeon — Predictive Intelligence for Global Operations & Network

## One-Line Description
An AI-powered autonomous supply chain co-pilot that detects disruptions 24–72 hours early, simulates cascade failures, and executes reroute decisions before a single delivery is missed.

## Problem Statement
Global supply chains manage millions of concurrent shipments across volatile, complex transportation networks. The critical failure is not a lack of data — it is a lack of **connected, actionable intelligence at the moment of disruption.**

- Disruptions detected too late — weather/port alerts arrive 6–12 hours after impact begins
- Cascading failures are invisible — one delayed shipment silently kills 10 downstream orders
- Rerouting is tribal knowledge — no system, just senior staff memory
- Reactive, not preventive — teams fight fires; no system prevents them

**The gap Pigeon closes:** Detection → Decision → Action in under 4 minutes, not 4 hours.

## Target Users
- Logistics & supply chain managers at mid-to-large enterprises
- Operations teams managing complex supplier networks with SLA commitments
- Freight forwarders and 3PLs running high-volume, time-sensitive cargo
- C-suite supply chain leaders needing real-time financial exposure visibility

## Key Goals
1. Compute a live risk score (0–100) per shipment leg, updated every 15 minutes, using real external signals
2. Simulate cascade failures across the shipment dependency graph and quantify dollar exposure in real time
3. Generate 3 ranked reroute options via Gemini API and auto-execute those within pre-approved thresholds
4. Power a real-time Command Center UI with live score updates via SSE

## Competition Context
Google Solution Challenge 2026. Demo story: "It's 2 AM. A typhoon just formed in the South China Sea. 18 of your shipments are in that lane. Your logistics manager is asleep." — system detects, simulates, decides, and acts in under 4 minutes.
