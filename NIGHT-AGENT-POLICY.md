# Night Agent Policy

## What the Night Agent does
Runs unattended every night at 02:00 UTC.
Produces a report by morning.
Exits code 1 if any CRITICAL gate fails.

## Failure policies

| Scenario | Action |
|----------|--------|
| Server does not start in 15s | Abort, write partial report, exit 1 |
| One test suite fails | Continue to next suite |
| CRITICAL finding active | Exit 1, block deployment |
| HIGH finding active | Log, continue, flag for triage |

## Why fail-fast on server startup
A hung process at 3am is worse than a clear failure with a timestamp.
The Night Agent's job is to surface problems clearly, not to retry indefinitely.

## Why continue-on-error per suite
Partial coverage beats no coverage.
If API tests fail, DB and AI tests still run independently.

## Deployment gate
CRITICAL findings block production deployment automatically via CI exit code 1.
No human approval can override a CRITICAL gate failure.
