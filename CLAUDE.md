# CLAUDE.md — Agent Context

This file tells an AI agent everything it needs to work on this QA harness effectively.

## What this repo is

A QA harness for the CoinHaven crypto support service. It is **not** the production service — it contains:
- A self-contained mock server (`coinhaven-server/`) that replicates the real API and its known bugs
- Test suites (`tests/`) covering API, AI safety, and database integrity
- Audit scripts (`scripts/`) for corpus inspection, prompt risk scoring, fee math, and answer drift

## How to start the server

```bash
cd coinhaven-server
npm install
node --experimental-sqlite scripts/seed.js
LLM_PROVIDER=mock ADMIN_OVERRIDE_TOKEN=test-secret-123 node --experimental-sqlite server.js
```

Health check: `curl http://localhost:3000/api/health` → `{"status":"ok"}`

## How to run tests

```bash
npm run test:all       # all three test suites
npm run audit:all      # all four audit scripts
bash scripts/night-run.sh  # full orchestrated run with report
```

## Known bugs in the mock server (test for these — do not fix them)

| ID | Location | Description |
|----|----------|-------------|
| B1 | `corpus/faq.md` | Says fee is 1.5%; correct value is 1.0% |
| B2 | `server.js /api/transfer` | No authentication on withdrawal endpoint |
| B3 | `server.js` GraphQL resolver | Uses `Math.round`; `db.feeFor()` uses `Math.floor` — diverge at e.g. 9999.99 |
| B4 | `rag.js buildSystemPrompt()` | `ADMIN_OVERRIDE_TOKEN` injected into every system prompt |

## Important files

- `FINDINGS.md` — active bug findings with severity and fix guidance
- `DECISIONS.md` — rationale for architecture choices
- `QUALITY-GATES.md` — pass/fail thresholds and deployment gate rules
- `HANDOFF.md` — current state, file map, next steps
- `data/adversarial-prompts.json` — canonical adversarial input dataset
- `.env.example` — required environment variables

## What NOT to do

- Do not fix bugs B1–B4 in `coinhaven-server/` — they are intentional targets
- Do not commit to `reports/` — it is gitignored
- Do not run `npm run audit:drift` without a running server — it calls `/api/chat`
- Do not use `node --loader ts-node/esm` — use `npx tsx` instead

## Test file conventions

All test files follow the same pattern:
- `pass(name)` / `fail(name, detail, severity)` functions
- `results[]` array accumulates results
- Final summary with exit code 1 if any failure
- Severity levels: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
