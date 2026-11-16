# Anaira AI Growth Engine v6.101.0 — Module 11: Marketing Automation Engine

## Scope
Module 11 hardens the existing visual workflow builder and autonomous schedule runner. The earlier audit marked scheduler recovery, concurrency, retries and DLQ testing as partial. This release focuses on those gaps rather than duplicating the existing builder.

## Delivered
- Workflow run leases now have per-claim UUID tokens and bounded `max_attempts` (default 5).
- Workflow claims remain atomic with `FOR UPDATE SKIP LOCKED`; stale 10-minute workflow leases are recovered with bounded exponential backoff.
- Exhausted stale workflow leases are moved to the tenant-scoped dead-letter queue and emit lifecycle events.
- Autonomous schedule claims recover stale 20-minute leases; exhausted schedule leases are disabled and recorded as failed schedule runs.
- Workflow-created follow-up tasks use a stable run/step key to prevent duplicate task creation after a worker crash.
- Workflow-created WhatsApp, approved WhatsApp template, email and SMS jobs use stable run/step idempotency keys.
- Workflow state transitions compare the current claim token so an old worker cannot overwrite a newer claim.
- Dead-letter retry/discard now runs in one database transaction through a `SECURITY INVOKER` function with manager RLS. It no longer performs split API updates.
- Added a live Automation Reliability panel: queue metrics, schedule attempts, stale lease diagnostics and dead-letter actions.
- Added tenant/entitlement-protected diagnostics API with bounded query sizes and exact open-DLQ count.

## Live Supabase migrations
Applied to the connected Anaira Growth Engine project:
- `20261116050622_growth_marketing_automation_reliability_v61100`
- `20261116050816_growth_marketing_automation_security_v61100a`

Live catalog verification confirmed the new workflow columns, task/job idempotency indexes, manager insert policy for workflow events, and the three database functions. The DLQ resolver is `SECURITY INVOKER`; anon cannot execute it and authenticated can execute it subject to its in-function manager check and table RLS.

## Verification
- Full `npm run verify:all`: **1,400 PASS lines, 0 FAIL lines**.
- Module 11 focused verifier: **28/28 PASS**.
- TypeScript/TSX syntax scan: **234 files, 0 syntax errors**.
- Static migration audit: no duplicate migration timestamps, no tables flagged for policy/privilege review, and no missing nearby search paths detected for security-definer functions.
- `npm run build`: **not completed** because this workspace does not have the Next.js executable installed (`next: not found`, exit 127).

## Not certified yet
- Browser end-to-end execution was not run.
- Worker concurrency/recovery behavior has SQL/static and live-catalog verification, but no synthetic production workflow was inserted or executed against live customer data.
- Cron invocation and deployment runtime were not verified.
- The live Supabase project still reports project-wide security advisories: 24 RLS-enabled tables without detected policies (some are intentionally service-role-only), two other authenticated-executable SECURITY DEFINER functions, and leaked-password protection disabled. These are not introduced by the Module 11 DLQ resolver; review the advisor findings before production certification.

## Operational note
The reliability panel is available at `/admin/ai-growth/automation/reliability`. Automatic lease recovery runs when the protected growth worker is invoked. Recovery cadence therefore depends on the deployment's configured cron frequency and a valid `CRON_SECRET`.
