# v6.119.0 — Module 1, Function 11: Alerts & Escalations

## Implemented
- Workspace-scoped Command Center alert API and UI.
- Configurable thresholds for overdue approvals, repeated execution failures, negative feedback and automatic escalation age.
- Signals: pending approval older than configured hours; failed executions at/above threshold in rolling 24 hours; negative feedback at/above threshold in rolling 7 days.
- Persisted alerts with organization/fingerprint deduplication, occurrence tracking and recurrence reactivation after resolution.
- Acknowledge, manual escalation, automatic escalation after configured age, and resolve lifecycle.
- Audit events for scans, settings updates and alert transitions.
- Owner/Manager-only scan, settings and lifecycle actions; CRM entitlement gate; service-role-only database RPCs and RLS-protected tables.
- External notifications are deliberately not sent. Escalation is an internal workspace record only.

## Migration
`supabase/migrations/20261116100000_growth_command_action_alerts_v62400.sql`

Apply after Functions 6–9 prerequisite migrations. No live database application is claimed in this release.

## Verification
Run `npm run verify:growth-command-center-alerts-v62400` and `npm run verify:all`.

Production build and authenticated browser E2E require installed dependencies, a running deployment and authorized test credentials; they are not certified by static verification.
