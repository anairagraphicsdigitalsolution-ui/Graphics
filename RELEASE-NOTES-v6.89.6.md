# Anaira AI Growth Engine v6.89.6

## CRM sales-stage schema alignment

The production CRM API and UI support 13 sales stages, but the prior `growth_leads_status_check` database constraint only allowed `new`, `contacted`, `qualified`, `won`, and `lost`. That mismatch caused valid updates (including `meeting_scheduled`) to be rejected by Postgres.

This release aligns the database constraint with the complete 13-stage lifecycle and adds an organization/status/update-time index for CRM pipeline queries.

## Migration

`supabase/migrations/20261113172000_growth_lead_sales_stages_v6896.sql`

Applied and verified on the connected Anaira Growth Engine Supabase project.

## Verification

- Full `npm run verify:all` suite: pending final local run.
- Production Next.js build: not certified until dependencies can be installed and build passes.
- Live third-party providers and tenant penetration tests remain external certification gates.
