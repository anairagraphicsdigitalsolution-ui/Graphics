# Anaira AI Growth Engine v6.93.2 — External Effect Reconciliation Guard

## Implemented
- Added a durable `external_effect_started_at` marker to outbound worker jobs.
- Worker persists the marker before invoking social publishing, WhatsApp, WhatsApp template, or email handlers.
- Successful jobs clear the marker only after the local completion update succeeds.
- Resumable upload jobs clear the marker before their controlled re-queue; persistence errors are surfaced.
- If a worker crashes or times out after provider dispatch began, stale recovery marks the job for manual provider-state reconciliation instead of blindly retrying it.
- If a handler throws after dispatch begins, automatic retry is suppressed because the provider may have accepted the request.
- Jobs that expire before provider dispatch remain eligible for bounded automatic retry.
- Atomic `SKIP LOCKED` claiming and service-role-only RPC permissions are preserved.

## Required deployment step
Apply `supabase/migrations/20261115090000_growth_external_effect_reconciliation_v6932.sql` to the confirmed dedicated Growth Engine Supabase project before deploying this application version. Do not apply it to an unrelated CRM project.

## Verification
- `npm run verify:all`: 944 PASS, 0 FAIL.
- New external-effect guard verifier: 12/12 PASS.
- Syntax scan is included in the full verification suite.
- Migration is included but has not been remotely applied.
- Live provider idempotency and reconciliation are not certified.

## Operational note
Jobs marked `OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED` must be checked against provider state before a human manually re-queues them. This deliberately trades automatic retry convenience for protection against duplicate customer messages or duplicate social posts.
