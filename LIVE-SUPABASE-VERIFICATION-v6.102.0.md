# Live Supabase Verification — Module 12

Project: `nrsdqrqkffhbicfskilb` (connected account: Mine Own)

Applied migrations:
- `20261116051934` — `growth_analytics_financial_reconciliation_v61200`
- `20261116052344` — `growth_analytics_financial_ledger_lockdown_v61200a`

Live catalog result:
- `growth_marketing_financial_entries` exists.
- RLS enabled: true.
- Policies: 1 (`growth_marketing_financial_manager_read`, SELECT).
- Expected indexes: 4 (plus primary-key index).
- Columns: 18.
- Both migration history entries found.
- `authenticated`: SELECT true; INSERT false; UPDATE false; DELETE false.
- `anon` SELECT: false.
- `service_role` INSERT: true.

No customer financial records were created as test data. Provider API sync and browser E2E were not executed.
