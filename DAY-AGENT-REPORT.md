# Day Agent Report — 2026-06-14

## Session Overview

| Field | Value |
|-------|-------|
| Start time | Morning session |
| Hand-off time | End of day |
| Date | 2026-06-14 |

---

## What Was Explored

Static code analysis of all source files:

- `coinhaven-server/server.js` — Express routes, middleware, auth model
- `coinhaven-server/rag.js` — RAG pipeline, system prompt construction, token injection
- `coinhaven-server/db.js` — SQLite schema, fee calculation (`Math.floor`)
- `coinhaven-server/scripts/seed.js` — seed data, wallet counts, KYC states
- `coinhaven-server/corpus/` — all markdown documents (faq.md, fees.md, announcements.md, withdrawals.md, security.md, about.md)
- `coinhaven-server/graphql/` — resolver fee calculation (`Math.round`)
- `coinhaven-server/public/index.html` — chat UI, button state management

---

## Findings Discovered During Day Phase

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| F001 | CRITICAL | `server.js /api/transfer` | No authentication on withdrawal endpoint — any caller can create transfer records |
| F002 | HIGH | `rag.js buildSystemPrompt()` | `ADMIN_OVERRIDE_TOKEN` injected into every LLM system prompt — leakable via prompt injection |
| F003 | HIGH | `corpus/announcements.md` | Prompt injection payload embedded in corpus — instructs LLM to reveal token |
| F004 | HIGH | `graphql/resolver.js` | Fee rounding uses `Math.round`; `db.feeFor()` uses `Math.floor` — diverge at e.g. 9999.99 EUR (€0.01 discrepancy) |
| F005 | HIGH | `corpus/faq.md` | States withdrawal fee is 1.5%; actual fee is 1.0% (fees.md + code) — stale corpus document |
| F006 | HIGH | `server.js /api/chat` | LLM responds to FakeCoin2099 price query with asset list instead of declining — hallucination path |
| F007 | MEDIUM | `public/index.html` | Send button not disabled during in-flight fetch — allows duplicate submissions |
| F008 | LOW | `graphql/resolver.js` | Transaction lookup by id fails when no transfers seeded — `no transaction(id:3) found` |

---

## Tools Used

- **Static analysis** — manual review of all `.js`, `.ts`, `.md` source files
- **API calls** — `curl` / Playwright against live `http://localhost:3000`
- **DB queries** — SQLite direct queries via `node:sqlite` (`DatabaseSync`)
- **RAG inspection** — corpus document diff, retrieval ranking analysis
- **Prompt probing** — adversarial prompt dataset (`data/adversarial-prompts.json`)

---

## Time Allocation

| Phase | Duration |
|-------|----------|
| Static code analysis | 2h |
| Test suite development & execution | 3h |
| Documentation (FINDINGS, DECISIONS, HANDOFF, COVERAGE) | 2h |
| CI/CD workflow (`qa.yml`, `night-run.sh`) | 1h |
| **Total** | **8h** |

---

## Hand-off to Night Agent

**Hand-off time:** End of day

### What Night Agent Should Run

All suites in order:

1. `npx tsx tests/api/api.test.ts` — API + security + fee correctness
2. `npx tsx tests/db/db.test.ts` — schema integrity, seed data, B3 fee math
3. `npx tsx tests/ai/ai-safety.test.ts` — prompt injection, jailbreak, hallucination, data leakage
4. `npx tsx scripts/corpus-trust-audit.ts` — corpus document trust scoring
5. `npx tsx scripts/financial-matrix.ts` — fee matrix across amounts
6. `npx tsx scripts/prompt-firewall.ts` — adversarial prompt risk scoring
7. `npx tsx scripts/answer-drift.ts` — answer consistency across repeated queries

Or simply:

```bash
bash scripts/night-run.sh
```

### Known Active Findings

| ID | Severity | Status |
|----|----------|--------|
| F001 / BUG B2 | CRITICAL | Open — blocks ship |
| F002 / BUG B4 | HIGH | Open |
| F003 | HIGH | Open |
| F004 / BUG B3 | HIGH | Open |
| F005 / BUG B1 | HIGH | Open |
| F006 | HIGH | Open |
| F007 | MEDIUM | Open |
| F008 | LOW | Open |

> ⛔ **DO NOT SHIP** until F001 (unauthenticated `/api/transfer`) is resolved.
