# v6.92.3 — Central Integration Ownership & API Vault Separation

## Implemented
- Integrations page now separates **Client Workspace APIs** from **Anaira Developer APIs**.
- Workspace BYOK remains keyed by `(organization_id, provider)` and can only be managed by workspace owners/managers or platform admins.
- Anaira developer credentials use a separate `growth_platform_integrations` encrypted vault. All read/write/test/delete endpoints require `admin_users` allow-list membership.
- Platform secrets are AES-256-GCM encrypted and masked in responses; raw secret values are never sent back to the browser.
- Direct browser access to platform integration storage is denied by RLS; only server-side service-role operations are intended.
- Workspace credentials override platform defaults. Shared AI/search/verification/email provider credentials are only inherited when the Super Admin explicitly enables `allow_shared_usage` for that platform provider.
- Platform-owned Meta and Google OAuth application credentials and Google Ads developer token are separated from client-owned OAuth refresh tokens, Meta account tokens, ad account IDs, Pages and WhatsApp numbers.
- Added client-scoped Google Ads credentials catalog and a live `customers:listAccessibleCustomers` connection test using the client refresh token plus platform developer token.
- Added platform connection tests for OpenAI, Google Custom Search, Meta app, Google OAuth app validation, Google Ads developer-token validation, ZeroBounce, Twilio Lookup and Resend.
- Prospect verification now resolves ZeroBounce and Twilio Lookup credentials from the tenant vault first, then the platform vault only when shared usage is explicitly enabled, then server environment fallback.

## Required migration
`supabase/migrations/20261114235000_growth_platform_integrations_v6923.sql`

This creates the platform vault and extends tenant provider allow-lists. Apply it to the dedicated Growth Engine Supabase project before using the platform tab. Do not apply it to an unrelated CRM, clinic, school, or client project.

## Still not completed / not certified
- Google Ads campaign, ad group, responsive search ad, conversion action and reporting lifecycle. This release adds credential ownership and an account-access test, not full Google Ads campaign automation.
- Automated Google Ads OAuth connect/callback UI; this version accepts a client refresh token in its workspace credential form.
- Meta video/carousel creative pipeline and live end-to-end certification.
- Shared-provider per-workspace quota/budget metering. Shared use is off by default and should remain off until commercial limits and metering are configured.
- End-to-end revenue attribution from ad click to reconciled CRM sale/payment.
- Provider live tests require real credentials and authorized accounts; validation-only checks are labelled as such.
- Clean production build, remote migration application, live provider E2E, tenant-isolation penetration testing and production load/recovery certification.

## Security boundaries
- Never put Supabase service-role keys, CRON_SECRET, internal signing secrets or encryption keys in browser-visible settings or `NEXT_PUBLIC_*` variables. Those remain server environment variables.
- A mailbox or phone validation result does not prove identity, ownership, buying intent or permission to contact.
- Shared platform credentials are not silently used: Super Admin must explicitly enable shared usage per provider. Workspace-owned credentials take precedence.
