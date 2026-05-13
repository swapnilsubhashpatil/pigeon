# Workflow — Pigeon

## TDD Policy
**Flexible** — tests recommended for complex, pure logic (risk score formula, BFS traversal, rule engine evaluation). Not required to block implementation for API route handlers or integration glue code. Write tests when the logic is non-trivial enough that a bug would be hard to spot manually.

## Commit Strategy
Conventional Commits:
- `feat:` — new feature or endpoint
- `fix:` — bug fix
- `chore:` — tooling, deps, config
- `docs:` — documentation only
- `refactor:` — code change with no behaviour change
- `test:` — adding or updating tests

## Code Review
Self-review OK — solo/small team hackathon project. Review checklist before marking a task done:
- Does the endpoint return the correct shape?
- Are external API errors handled (don't crash the server)?
- Is sensitive data (API keys) only read from env vars?

## Verification Checkpoints
Manual verification required after each **phase** completion within a track. Each phase should have a clear "how to verify" step in the plan.

## Task Lifecycle
```
todo → in_progress → review → done
```
Move to `in_progress` when starting. Move to `done` only after manual verification passes.

## Environment Variables
All API keys and secrets in `.env` at the backend root. Never commit `.env`. Use `.env.example` to document required vars.

Required vars:
```
GEMINI_API_KEY=
TOMORROW_IO_API_KEY=
AIS_STREAM_API_KEY=
VESSEL_FINDER_API_KEY=
GOOGLE_MAPS_API_KEY=
NEWS_API_KEY=
SLACK_WEBHOOK_URL=
PORT=3000
```

## Directory Conventions
```
backend/
├── src/
│   ├── modules/
│   │   ├── risk-engine/       ← signal fetch + scoring logic
│   │   ├── cascade-simulator/ ← graph + BFS traversal
│   │   └── decision-engine/   ← Gemini + rule engine
│   ├── data/                  ← seed JSON files
│   ├── routes/                ← Express route handlers
│   ├── types/                 ← shared TypeScript interfaces
│   ├── store/                 ← in-memory data store
│   └── index.ts               ← Express app entry point
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```
