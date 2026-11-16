# Anaira AI Growth Engine v6.106.0 — LinkedIn Organization Analytics

## Implemented in source
- Opt-in LinkedIn organization analytics OAuth scopes; publishing-only OAuth remains the default.
- OAuth callback discovers approved organization ACLs and stores the allowed organization URNs in the connected tenant account metadata.
- New authenticated `/api/growth/linkedin-analytics` endpoint fetches page, follower and share statistics for 7/28/90-day periods.
- Organization URN is checked against the same tenant account's discovered ACL list before any provider request.
- Expiring access tokens are refreshed and persisted encrypted when refresh credentials are available.
- Partial provider endpoint failures are returned as warnings, not silently represented as successful complete data.
- Tenant-scoped analytics snapshots support LinkedIn; authenticated direct writes remain revoked.

## Migration
- `20261116065242_growth_linkedin_analytics_v61600.sql` and `20261116065521_growth_linkedin_analytics_grant_lockdown_v61600b.sql`

## Verification
- Focused verifier: 11/11 PASS.
- Syntax verifier: 242 TS/TSX files, 0 syntax errors.
- Live LinkedIn certification is not claimed. Requires approved LinkedIn API product/scopes, an administrator on a Company Page, valid OAuth consent and real API requests.

## Required environment
- `LINKEDIN_ORGANIZATION_ANALYTICS_ENABLED=true` (only after API product approval)
- `LINKEDIN_API_VERSION=202610` (update to a currently supported version before deployment)
