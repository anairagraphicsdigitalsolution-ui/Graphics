# Anaira AI Growth Engine v6.89.7

## New: customer proposal response and sales closure

- Approved proposal email now contains a secure proposal review/decision URL.
- A 256-bit random token is generated on the server; only its SHA-256 hash is stored in Supabase.
- Customer can view proposal detail and accept or decline without logging into the workspace.
- Response is one-time, expires at the proposal validity date or 30 days by default, and is processed under a database row lock.
- Customer acceptance moves the related CRM deal to Won; rejection moves it to Lost; both append a CRM timeline event.
- Public response API exposes only proposal fields and never exposes customer email or tenant credentials.

## Critical schema fix: 13-stage CRM pipeline

The live `growth_leads_status_check` constraint previously allowed only five statuses, despite the UI/API using a 13-stage pipeline. The migration now permits all 13 supported stages and adds an organization/status index. This fixes updates such as `discovered`, `interested`, `meeting_scheduled`, `proposal`, `negotiation`, and `follow_up_later` being rejected by Postgres.

## Supabase migrations

- `20261113172000_growth_lead_sales_stages_v6896.sql`
- `20261113173000_growth_proposal_customer_response_links_v6897.sql`
- `20261113173500_growth_proposal_response_token_guard_v6897a.sql`
- `20261113174000_growth_proposal_queue_null_guard_v6897b.sql`

These changes were applied to the connected Anaira Growth Engine project and their schema/permissions were queried afterward.

## Tests

- Full regression suite: PASS (637 passing assertions; exit code 0).
- 171 TypeScript/TSX source files: 0 syntax errors.
- Proposal response: 12/12.
- CRM status schema: 6/6.

## Release limitation

The production build remains uncertified because dependency installation timed out and offline package installation could not find the required packages in cache. Live provider delivery, OAuth, native WhatsApp calling, deployment, penetration, load and backup/restore tests remain external release gates.
