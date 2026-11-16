# Module 12 — Analytics & Reports setup

## 1. Apply migration

Migration already applied to the connected Supabase project:

`supabase/migrations/20261116051934_growth_analytics_financial_reconciliation_v61200.sql`
`supabase/migrations/20261116052344_growth_analytics_financial_ledger_lockdown_v61200a.sql`

## 2. Record financial entries

Open AI Growth Control Center → Analytics → Actual Spend & Revenue Reconciliation.

Owners/managers can record:
- Marketing spend
- Recognized revenue
- Refunds

Each entry requires amount, ISO currency and date. Use a stable external reference for provider statements, invoices or refund IDs to prevent duplicate posting. Add the exact campaign/UTM campaign identifier to enable campaign-level matching.

Refunds must be linked to a lead, campaign or external reference. Financial entries are positive amounts; refund rows are subtracted from gross revenue in the report.

## 3. Meta Ads spend sync

Run the existing Meta Ads Insights sync for the connected Facebook account and ad account. The sync fetches the ad account currency and records daily campaign spend. Deterministic external references make repeat syncs update the same entries. If currency lookup or ledger persistence fails, inspect the response's `financialSyncWarning` and reconcile the account manually.

## 4. Reading the report

- Net revenue = recognized revenue − refunds.
- ROAS = net revenue ÷ actual spend, only when spend is greater than zero.
- CPL = campaign spend ÷ matching leads, only when spend and matching UTM campaign leads exist.
- CAC = campaign spend ÷ matching won leads, only when spend and won leads exist.
- Revenue variance = posted ledger net revenue − attributed event revenue.

Currencies are never combined and no exchange rate is inferred. Positive variance means ledger revenue is higher than attributed revenue. Investigate differences; the report does not auto-adjust either source.

## 5. Access controls

- Workspace owner/manager: read and record financial entries.
- Workspace editor/viewer/client: read analytics only, subject to CRM entitlement.
- Database table has RLS and manager-only SELECT policy. Authenticated direct INSERT/UPDATE/DELETE and anonymous access are denied; writes are mediated by the server/service role.

## 6. Validation notes

The report defaults to the last 30 days. The API caps each data source at 5,000 rows and exposes `truncatedSources`; narrow the date range before relying on ratios if a cap is reached.
