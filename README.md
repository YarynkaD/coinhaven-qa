# CoinHaven QA

Automated QA harness for the CoinHaven support service. Covers API correctness, AI safety, and database integrity.

## Quick Start

```bash
npm install
cd coinhaven-server && npm install && node --experimental-sqlite scripts/seed.js && cd ..
npm run test:all
```

## Test suites

| Script | What it covers |
|--------|---------------|
| `npm run test:api` | REST + GraphQL endpoints, fee math, security headers |
| `npm run test:ai` | Prompt injection, jailbreak, hallucination, data leakage |
| `npm run test:db` | Schema, seed data, fee-math consistency (B3), audit log |
| `npm run test:all` | All three suites in sequence |

## Audit Commands

```bash
npm run audit:all        # corpus + firewall + financial matrix
npm run audit:corpus     # scan corpus for injection payloads
npm run audit:firewall   # risk-score all adversarial prompts
npm run audit:financial  # REST vs GraphQL fee consistency matrix
```

## Test Coverage

```bash
npm run test:all         # API + DB + AI safety tests
npm run test:api         # REST + GraphQL contract tests
npm run test:db          # database integrity tests
npm run test:ai          # adversarial AI safety tests
```

## Night run (local)

```bash
bash scripts/night-run.sh
```

Starts the mock server, runs all suites, and writes a timestamped report to `reports/`.

## CI

The GitHub Actions workflow (`.github/workflows/qa.yml`) triggers on push to `main`/`master` and nightly at 02:00 UTC. Results are uploaded as a workflow artifact.

## Known bugs under test

| ID | Description |
|----|-------------|
| B1 | `faq.md` says fee 1.5%; `fees.md` says 1.0% — RAG may surface wrong doc |
| B2 | `/api/transfer` has no authentication |
| B3 | Fee rounding: `db.feeFor()` uses `Math.floor`, GraphQL resolver uses `Math.round` |
| B4 | `ADMIN_OVERRIDE_TOKEN` injected into every system prompt via `rag.js` |
