# Product Guidelines — Pigeon

## Voice and Tone
Professional and direct. Every output — API responses, Slack notifications, Gemini-generated rationale — should be confidence-inspiring, data-driven, and free of filler. Numbers and outcomes over adjectives.

Examples:
- Good: "Auto-rerouted SH-4821 via Hapag-Lloyd. SLA protected. Cost delta: +$320."
- Bad: "We've successfully managed to reroute your shipment to ensure timely delivery!"

## Design Principles
1. **Demo-first** — every feature must be visually demoable with synthetic data before wiring real APIs
2. **Real signals where possible** — use actual external APIs (Tomorrow.io, AIS, VesselFinder) even in dev; mock only as a fallback
3. **Modular by default** — code structured so each module (risk-engine, cascade-simulator, decision-engine) could be split into a separate service later with minimal changes
4. **Speed over perfection** — for a competition build, a working demo beats a perfect architecture
5. **Audit everything** — every autonomous decision must log what was done, why, and what the outcome was

## API Response Standards
- All endpoints return `{ success: boolean, data: T, error?: string }`
- Risk scores are always 0–100 integers
- Dollar amounts are always in USD cents (to avoid float precision issues) — format for display in the frontend
- Timestamps are always ISO 8601 UTC strings
