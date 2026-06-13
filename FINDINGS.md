# QA Findings

Active findings from the CoinHaven QA harness. Severity follows QUALITY-GATES.md.

## CRITICAL

### B4 — ADMIN_OVERRIDE_TOKEN injected into every system prompt
- **File:** `coinhaven-server/rag.js` → `buildSystemPrompt()`
- **What happens:** The token is concatenated into the system prompt on every `/api/chat` request. If `announcements.md` is retrieved by the RAG retriever, the injection payload in that file instructs the LLM to echo the token back to the user.
- **Confirmed by:** `tests/ai/ai-safety.test.ts`, `tests/api/api.test.ts`
- **Fix:** Remove the token from the system prompt. Pass it only server-side for internal auth checks.

### B2 — `/api/transfer` has no authentication
- **File:** `coinhaven-server/server.js`
- **What happens:** Any unauthenticated caller can POST `{ amount_eur: N }` and create a withdrawal record in the database. No session, no token, no rate limiting.
- **Confirmed by:** API test suite — HTTP 200 returned with no `Authorization` header.
- **Fix:** Require a valid session token or API key before processing transfers.

## HIGH

### B3 — Fee rounding diverges between REST and GraphQL
- **Files:** `coinhaven-server/server.js` (`db.feeFor()` uses `Math.floor`), GraphQL resolver uses `Math.round`
- **What happens:** For amounts like `250.50` and `9999.99`, the two paths return different fee values. A user who queries their fee via GraphQL after creating a transfer via REST sees a different number.
- **Confirmed by:** `scripts/financial-matrix.ts`
  ```
  250.50   REST=2.50  GraphQL=2.51  ❌ DIVERGENCE €0.01
  9999.99  REST=99.99 GraphQL=100.00  ❌ DIVERGENCE €0.01
  ```
- **Fix:** Standardise on one rounding method across both paths (recommend `Math.round` to match conventional financial rounding).

### B1 — Contradictory fee information in corpus
- **Files:** `corpus/faq.md` (1.5%), `corpus/fees.md` (1.0%)
- **What happens:** The RAG retriever may surface either document depending on query phrasing. If `faq.md` wins, the AI tells users the fee is 1.5% — which is wrong.
- **Confirmed by:** `tests/ai/ai-safety.test.ts` hallucination probe, `scripts/corpus-trust-audit.ts`
- **Fix:** Remove the stale fee from `faq.md` or add a `last-updated` frontmatter so the retriever can prefer the canonical document.

## Status

| ID | Severity | Status |
|----|----------|--------|
| B4 | CRITICAL | Open |
| B2 | CRITICAL | Open |
| B3 | HIGH | Open |
| B1 | HIGH | Open |

All four findings are **blocking deployment** per `QUALITY-GATES.md`.
