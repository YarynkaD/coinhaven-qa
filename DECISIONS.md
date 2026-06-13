# Design Decisions

Rationale for key choices in the QA harness. Record decisions here so future contributors understand the "why", not just the "what".

## Use `npx tsx` instead of `ts-node`

`ts-node` with `--loader` flags is deprecated in Node 22 and produces warnings. `tsx` handles ESM TypeScript without loader flags and works reliably with `"type": "module"`. All scripts and test suites use `npx tsx`.

## Mock mode as the default CI target

Running against the live Anthropic API in CI would:
- Incur cost on every push
- Make tests non-deterministic (model outputs vary)
- Require secret rotation and management

The mock server (`LLM_PROVIDER=mock`) returns deterministic responses keyed on message content, which makes injection/leak tests reliable. Live LLM tests are opt-in via `ANTHROPIC_API_KEY`.

## `continue-on-error: true` on every test step

A failure in the API suite should not suppress the AI safety or DB results. Partial coverage is more useful than a silent abort. The CI verdict step always runs (`if: always()`) and summarises all findings. See also `NIGHT-AGENT-POLICY.md`.

## `node:sqlite` (built-in) over `better-sqlite3`

The server already uses Node's built-in `node:sqlite` (`DatabaseSync`). Using the same module in the DB test suite means zero extra dependencies and identical behaviour. Requires Node ≥ 22, which is pinned in `.github/workflows/qa.yml`.

## `Math.floor` for fee storage (REST path)

`db.feeFor()` intentionally uses `Math.floor` to match the real-world behaviour of the production system under test. The GraphQL resolver in the mock uses `Math.round` to replicate bug B3 so it can be detected. Do not "fix" this in the mock — the discrepancy is the bug being tested.

## Risk score thresholds in `prompt-firewall.ts`

| Score | Verdict |
|-------|---------|
| ≥ 0.6 | HIGH RISK |
| ≥ 0.3 | MEDIUM RISK |
| < 0.3 | LOW RISK |

Weights: injection keywords +0.4, announcements signal +0.3, jailbreak patterns +0.3. Thresholds were calibrated so that known-safe RAG golden queries score LOW and known-dangerous direct injection queries score MEDIUM or HIGH.

## `reports/` is gitignored

Night-run reports are timestamped text files that change on every run. Committing them would pollute the git history with noise. `COVERAGE.md` and `FINDINGS.md` are the canonical human-readable summaries and are tracked.
