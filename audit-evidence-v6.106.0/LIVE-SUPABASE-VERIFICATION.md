# Live Supabase verification — v6.106.0

Target: linked Growth Engine Supabase project `nrsdqrqkffhbicfskilb` (Mine Own)

Applied migrations:
- `20261116065242` — `growth_linkedin_analytics_v61600`
- `20261116065521` — `growth_linkedin_analytics_grant_lockdown_v61600b`

Verified live:
- `growth_social_insights` platform check allows facebook, instagram and linkedin.
- RLS is enabled.
- Index `growth_social_insights_org_platform_period_idx` exists.
- `anon`: no SELECT/INSERT/UPDATE/DELETE/TRUNCATE.
- `authenticated`: SELECT only; no INSERT/UPDATE/DELETE/TRUNCATE.
- `service_role`: SELECT/INSERT/UPDATE/DELETE/TRUNCATE allowed.

The migration versions above were confirmed through the Supabase migration listing. No provider OAuth was initiated and no LinkedIn API call was made because live LinkedIn app approval and account authorization have not been supplied/verified.
