#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/coinhaven-server"

# Use Node 22 if available (required for node:sqlite)
NODE="${NODE_BIN:-$(command -v node)}"
for candidate in "$HOME/.nvm/versions/node/v22"*/bin/node "$HOME/.nvm/versions/node/v24"*/bin/node; do
  [ -x "$candidate" ] && NODE="$candidate" && break
done
# Prepend Node 22 bin to PATH so npx/tsx also use it
export PATH="$(dirname "$NODE"):$PATH"
REPORT_DIR="$REPO_ROOT/reports"
REPORT="$REPORT_DIR/night-report-$(date +%Y%m%d-%H%M%S).txt"
SERVER_PID=""

mkdir -p "$REPORT_DIR"

# ── Logging ──────────────────────────────────────────────────────────────────
log() { echo "$*" | tee -a "$REPORT"; }
hr()  { log "$(printf '─%.0s' {1..56})"; }

PASSED=0
FAILED=0
CRITICAL=0

# ── Cleanup ──────────────────────────────────────────────────────────────────
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

# ── Header ───────────────────────────────────────────────────────────────────
hr
log "  CoinHaven QA — Night Run"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "  Report: $REPORT"
hr

# ── Start server ─────────────────────────────────────────────────────────────
log ""
log "▶  Starting server..."

mkdir -p "$SERVER_DIR/data"
(cd "$SERVER_DIR" && "$NODE" --experimental-sqlite scripts/seed.js 2>/dev/null)

(cd "$SERVER_DIR" && LLM_PROVIDER="${LLM_PROVIDER:-mock}" ADMIN_OVERRIDE_TOKEN="${ADMIN_OVERRIDE_TOKEN:-test-secret-123}" \
  "$NODE" --experimental-sqlite server.js > /tmp/coinhaven-server.log 2>&1) &
SERVER_PID=$!

# Wait up to 15s for health
for i in $(seq 1 15); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    log "  ✅  Server ready (${i}s)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    log "  ❌  Server did not start within 15 seconds"
    log "  Server log:"
    cat /tmp/coinhaven-server.log | tee -a "$REPORT"
    exit 1
  fi
  sleep 1
done

# ── Run test suites ───────────────────────────────────────────────────────────
run_suite() {
  local name="$1"
  local cmd="$2"
  local env_vars="${3:-}"

  log ""
  hr
  log "  Suite: $name"
  hr

  local output
  local exit_code=0

  output=$(cd "$REPO_ROOT" && eval "$env_vars $cmd" 2>&1) || exit_code=$?

  echo "$output" | tee -a "$REPORT"

  # Count CRITICAL failures from output
  local suite_critical
  suite_critical=$(echo "$output" | grep -c '\[CRITICAL\]' || true)
  local suite_failed
  suite_failed=$(echo "$output" | grep -c '❌' || true)
  local suite_passed
  suite_passed=$(echo "$output" | grep -c '✅' || true)

  PASSED=$((PASSED + suite_passed))
  FAILED=$((FAILED + suite_failed))
  CRITICAL=$((CRITICAL + suite_critical))

  if [ "$exit_code" -ne 0 ]; then
    log ""
    log "  ⚠️  Suite exited with code $exit_code"
  fi
}

run_suite "API Tests" \
  "npx tsx tests/api/api.test.ts" \
  "BASE_URL=http://localhost:3000"

run_suite "AI Safety Tests" \
  "npx tsx tests/ai/ai-safety.test.ts" \
  "AI_ENDPOINT=http://localhost:3000/api/chat LLM_PROVIDER=${LLM_PROVIDER:-mock} ADMIN_OVERRIDE_TOKEN=${ADMIN_OVERRIDE_TOKEN:-test-secret-123}"

run_suite "DB Tests" \
  "npx tsx tests/db/db.test.ts" \
  "DB_PATH=$SERVER_DIR/data/coinhaven.db"

# ── Summary ───────────────────────────────────────────────────────────────────
log ""
hr
log "  NIGHT RUN SUMMARY"
hr
log "  Passed   : $PASSED"
log "  Failed   : $FAILED"
log "  Critical : $CRITICAL"
log ""

if [ "$CRITICAL" -gt 0 ]; then
  log "  ⛔  $CRITICAL CRITICAL finding(s) — DO NOT SHIP"
  log "  Report saved: $REPORT"
  hr
  exit 1
elif [ "$FAILED" -gt 0 ]; then
  log "  ⚠️   $FAILED non-critical failure(s) — review before release"
  log "  Report saved: $REPORT"
  hr
  exit 0
else
  log "  ✅  All checks passed"
  log "  Report saved: $REPORT"
  hr
  exit 0
fi
