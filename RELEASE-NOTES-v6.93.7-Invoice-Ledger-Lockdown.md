# Anaira AI Growth Engine v6.93.7 — Invoice Ledger Lockdown

## Changes
- Added a forward-only SQL migration to explicitly enable RLS on `growth_manual_payments` and `growth_invoices`.
- Explicitly revoked all table privileges from `PUBLIC`, `anon`, and `authenticated`.
- Explicitly granted table access only to `service_role`, matching the existing service-only access design.
- Added a verifier with 10 source assertions and included it in `verify:all`.
- Improved the static migration audit to distinguish intentional service-role-only tables from tables that need policy/privilege review.

## Verification
- 75 SQL migration files in source; lexical order valid.
- 67 created tables detected.
- 0 tables missing explicit RLS enablement statements in the static scan.
- 21 tables have no detected row policy but are explicitly service-role-only by static grant/revoke analysis.
- 0 tables remain in the static "policy or privilege review required" category.
- 992+ prior assertions retained; full suite run is recorded in `VERIFICATION-v6.93.7.log`.
- Production build remains blocked because Next.js dependencies are not installed (`next: not found`).
- No remote migration was applied. Live database catalog checks remain pending.
