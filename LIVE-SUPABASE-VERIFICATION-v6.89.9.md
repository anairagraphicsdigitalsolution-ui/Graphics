# Live Supabase Verification — v6.89.9

## Project
- Connected project: Anaira AI Growth Engine Supabase project (`nrsdqrqkffhbicfskilb`).
- Migration: `growth_website_intelligence_v1`.
- Remote migration version: `20261113180052`.

## Verified
- `public.growth_website_audits` exists.
- Expected columns: `id`, `organization_id`, `website_id`, `audit_type`, `score`, `report`, `created_by`, `created_at`.
- `organization_id` references `growth_organizations`.
- `website_id` references `growth_websites`.
- Tenant/site/time history index exists.
- RLS is enabled.
- `anon` and `authenticated` do not have direct SELECT access.
- `service_role` has SELECT and INSERT table privileges.
- Table is used only through authenticated server-side routes; the server route validates workspace membership before using its service-role client.

## Verified configured website
- Website: Anaira Graphics
- Domain: `graphics.anairapos.in`
- URL: `https://graphics.anairapos.in`
- Ownership status: `verified`

## Note
This confirms the database root cause and required permissions. A live browser click-through in the user's localhost session was not performed from this environment.
