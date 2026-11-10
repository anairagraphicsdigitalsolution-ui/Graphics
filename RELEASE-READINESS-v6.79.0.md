# Anaira AI Growth Engine v6.79.0 — Workflow Versioning & Operations

## Release scope

This release continues from v6.78.0. It does not replace the earlier SaaS foundation, CRM, tenant WhatsApp, billing metering, website handoff, or email reply work.

### Implemented
- Immutable tenant-scoped workflow version snapshots.
- Version number and published-version tracking on workflow rules.
- Editing a workflow creates a new version and automatically leaves it unpublished until a manager republishes it.
- Legacy workflows receive a baseline snapshot the first time they are edited.
- Restore an older snapshot by creating a new version; historical snapshots are not overwritten.
- Safe workflow simulation endpoint. It evaluates simple lead conditions and produces an execution plan without creating tasks, queueing messages, or calling providers.
- Workflow run event timeline: run start, step start/success/wait/skip/failure and terminal run status.
- Failed-run retry and safe cancellation for queued/failed runs.
- Optimistic version check prevents overwriting a concurrently updated workflow.
- Version/audit tables are RLS-enabled and tenant-scoped. Writes are restricted to the server-side service role; authenticated users receive read-only access to tenant-visible history.

### Existing platform capabilities retained
- 44 Growth API route files.
- 14 dedicated AI Growth page route files.
- Team roles/invitations, CRM Customer 360, unified inbox/human handoff, WhatsApp multiple phone-number architecture, plans/subscriptions/usage metering, platform tenant directory.

## Verification
- `npm run verify:all` passes.
- 118 TypeScript/TSX source files pass the repository syntax checker with zero syntax errors.
- Workflow engine checks: 11/11.
- Live Supabase migration history includes:
  - `growth_workflow_versions_and_runs_v679`
  - `growth_workflow_audit_grants_hardening_v6791`
  - `growth_workflow_version_policy_hardening_v6792`
- Live database verified: both new tables have RLS enabled; tenant-scoped policies exist; authenticated has SELECT only; `anon` has no direct table grants; service_role has required privileges; workflow version columns and indexes exist.

## Not certified / remaining
- The workflow editor is still a structured sequential step editor, not a drag-and-drop node canvas.
- Parallel branches, nested graph joins, workflow rollback UI for complex graph structures, and workflow-level release promotion are not implemented.
- Simulation covers the current sequential steps and simple lead-field conditions; it is not a provider sandbox or full execution emulator.
- Retry semantics are at-least-once. A provider side effect could be repeated if the provider succeeds but the worker fails before recording step completion; provider-level idempotency must be added before claiming exactly-once execution.
- Payment checkout, invoice issuance, payment webhooks and reconciliation are not implemented.
- Inbound email webhook ingestion, bounce/complaint/unsubscribe lifecycle are not fully implemented.
- Live Meta/Instagram/LinkedIn/YouTube/Resend provider E2E, multi-tenant penetration/load testing, full Next.js production build and Vercel deployment are not certified.
- Supabase Auth leaked-password protection and the pre-existing `is_anaira_admin()` security advisor finding remain separate platform configuration/hardening tasks.

## Deployment notes
- Apply the three v6.79 migrations to the matching Anaira Supabase project (already applied and verified for this release).
- Deploy the ZIP/source to the intended Vercel project only after environment variables and provider credentials are checked.
- No Vercel deployment was performed by this release task.
