# Anaira AI Growth Engine v6.93.3 — Reconciliation Audit Workflow

## Implemented
- Added a workspace-scoped manager API to list outbound jobs whose provider outcome is ambiguous.
- Added three explicit resolution actions: confirm delivered, retry only after provider state was checked, or discard.
- Each action requires written evidence (12–2,000 characters).
- Added a database RPC that independently checks manager permissions, locks the job row, validates the ambiguous state, writes an immutable reconciliation evidence record, and updates the job atomically.
- The listing does not expose job payloads or private customer message content.
- Tenant scoping is enforced in the API and again inside the database function.

## Required deployment
Apply `20261115100000_growth_external_effect_reconciliation_audit_v6933.sql` after v6.93.2 migration on the confirmed dedicated Growth Engine Supabase project. The reconciliation API returns 503 until the migration is applied.

## Verification limits
Source-level checks cover role gates, tenant scope, privacy, evidence requirements, state validation, row locking and audit writes. No live Supabase migration, real provider reconciliation or production authorization test has been performed.
