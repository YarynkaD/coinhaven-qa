# Handoff Document

State of the CoinHaven QA harness as of 2026-06-14.

## What this repo is

A standalone QA harness for the CoinHaven support service. It is not part of the production codebase. It runs against a self-contained mock server (`coinhaven-server/`) that replicates the real service's API surface and known bugs.

## Current state

- **4 open findings**, 2 CRITICAL, 2 HIGH — see `FINDINGS.md`
- **Deployment is blocked** (CRITICAL gate active)
- All test suites passing structurally; failures are intentional bug detections
- CI runs nightly at 02:00 UTC via `.github/workflows/qa.yml`

## How to run

```bash
# Install
npm install
cd coinhaven-server && npm install && cd ..

# Seed database and start mock server
cd coinhaven-server && node --experimental-sqlite scripts/seed.js && cd ..
LLM_PROVIDER=mock ADMIN_OVERRIDE_TOKEN=test-secret-123 \
  node --experimental-sqlite coinhaven-server/server.js &

# Run all tests
npm run test:all

# Run all audit scripts
npm run audit:all

# Full night run (starts server, runs everything, writes report)
bash scripts/night-run.sh
```

## File map

```
tests/
  api/api.test.ts         REST + GraphQL + security tests
  ai/ai-safety.test.ts    Injection, jailbreak, hallucination, leakage
  db/db.test.ts           Schema, seed data, fee math, audit log

scripts/
  night-run.sh            Orchestrates full run + report
  corpus-trust-audit.ts   Scans corpus/ for injection payloads
  prompt-firewall.ts      Risk-scores adversarial-prompts.json
  financial-matrix.ts     REST vs GraphQL fee divergence table
  answer-drift.ts         Repeated-query variance and leak detection

data/
  adversarial-prompts.json  Canonical adversarial input dataset
```

## Things to know before touching anything

1. The mock server deliberately replicates bugs B1–B4. Do not fix them in the server — the tests exist to detect them.
2. `node:sqlite` requires Node ≥ 22. The CI workflow pins this. Local Node 20 will fail the DB test.
3. `reports/` is gitignored. Night-run output lives there locally and in CI artifacts.
4. The corpus directory (`coinhaven-server/corpus/`) does not exist in this repo's mock — it belongs to the real server. `corpus-trust-audit.ts` exits cleanly when it's absent.

## Next steps (recommended)

- [ ] Fix B2: add authentication to `/api/transfer`
- [ ] Fix B4: remove `ADMIN_OVERRIDE_TOKEN` from system prompt construction
- [ ] Fix B3: standardise fee rounding to `Math.round` across REST and GraphQL
- [ ] Fix B1: remove stale fee value from `corpus/faq.md`
- [ ] Add live LLM smoke test (opt-in, requires `ANTHROPIC_API_KEY`)
- [ ] Add concurrency tests for transfer endpoint
