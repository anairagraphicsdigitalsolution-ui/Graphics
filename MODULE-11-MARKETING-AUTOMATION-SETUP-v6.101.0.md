# Module 11 — Marketing Automation Engine setup

## Admin route
Open **AI Growth → Automation → Reliability & DLQ**, or visit:

`/admin/ai-growth/automation/reliability`

## What the panel shows
- Workflow queued/running/failed/succeeded counts (latest 500-run sample).
- Open dead-letter count (exact count) and up to 50 recent dead-letter records.
- Enabled recurring schedules, their next-run time, lease, attempts and last error.
- Processing/failed jobs and stale job/workflow/schedule leases (bounded recent samples).
- Owner/manager-only Retry and Discard actions for open dead letters.

## Recovery behavior
- Workflow run lease: 10 minutes. An expired lease is requeued with bounded exponential backoff unless its attempt budget is exhausted; exhausted runs are placed in the DLQ.
- Autonomous schedule lease: 20 minutes. Expired leases are retried with bounded backoff; exhausted stale schedule leases are disabled and a failed schedule-run record is created.
- Workflow-created tasks and outbound jobs use deterministic run/step idempotency keys to avoid duplicate records when a worker is reclaimed after a crash.
- Manual DLQ retry resets the workflow attempt counter and queues the run in the same database transaction that marks the DLQ record retried.
- Discard is also atomic and audited. It does not delete the original workflow run.

## Deployment requirements
- Configure `CRON_SECRET` in the deployment environment.
- Invoke `/api/growth/worker` with `Authorization: Bearer <CRON_SECRET>` using the deployment's configured cron cadence.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not expose it in `NEXT_PUBLIC_*` variables or browser code.
- Ensure the deployed app contains both Module 11 Supabase migrations before enabling production workflows.

## Important limitations
- The panel is diagnostic; it does not itself run the worker or change the deployment cron frequency.
- A provider call with an ambiguous external outcome remains subject to the existing external-effect reconciliation policy; do not blindly replay an uncertain send.
- Run browser E2E and a controlled test workspace workflow before production certification.
