# Anaira AI Growth Engine v6.80.4

## Workflow reliability: durable Dead-Letter Queue

- Added `growth_workflow_dead_letters` migration with unique run id, tenant/workflow/lead references, failure metadata, state and indexes.
- Terminal workflow failures are persisted to the DLQ idempotently by the worker.
- Added tenant-scoped DLQ list API with status filtering.
- Added owner/manager-only manual retry and discard actions.
- Manual retry safely resets failed run state and records a workflow event.
- Discard is explicit, auditable and terminal; already-resolved items cannot be replayed.
- Added 7 DLQ regression checks to `npm run verify:all`.

## Verification
- `npm run verify:all`: PASS, including all existing checks and 7/7 new DLQ checks.
- Existing workflow engine: 17/17.
- Visual builder regression: 5/5.
- Email unsubscribe: 9/9.
- WhatsApp multi-number: 14/14.
- Cashfree: 11/11.
- CRM reports: 7/7.
- Inbound email: 10/10.
- ZIP integrity: PASS.

## Not certified
- This does not implement true parallel graph execution, branch joins or loop nodes.
- Production Next.js build and live provider E2E remain unverified.
- The new Supabase migration is included but was not applied to the live project in this release.
- Full tenant lifecycle, feature entitlements, recurring billing/refunds/GST, advanced attribution and production security certification remain open.

Main portfolio pages and general Website Settings were not modified.
