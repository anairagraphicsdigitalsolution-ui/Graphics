# Anaira AI Growth Engine v6.92.4 — Google Ads, Attribution & Usage Metering

## Implemented in source
- Client workspace Google Ads OAuth authorization-code flow with signed, short-lived state cookie; the callback revalidates active workspace membership before storing tokens.
- Anaira Developer vault remains owner of Google OAuth app credentials and Google Ads developer token. Client refresh tokens, customer IDs and optional client-owned OAuth app credentials remain encrypted in the workspace integration vault; client OAuth app credentials override the Anaira OAuth app when supplied.
- Google Ads accessible customer discovery and workspace account selection.
- Google Search campaign execution creates a daily budget, paused campaign, ad group, phrase-match keywords and responsive search ad through the Google Ads API mutate endpoint.
- Campaign activation is a separate owner/manager action with explicit confirmation; no automatic campaign launch or budget increase.
- Recurring Google Ads analysis schedule can pause campaigns under owner-configured spend/click/impression thresholds, only when the client integration auto-pause policy and conversion action are enabled. It never resumes campaigns or increases budgets.
- GAQL reporting for campaign status, impressions, clicks, spend, CTR, conversions and conversion value.
- First-party lead form captures GCLID/GBRAID/WBRAID and UTM fields when supplied in the landing-page query string. Advertising measurement consent is separate from contact consent.
- CRM `won` transition records idempotent revenue attribution. With an explicitly granted ad-user-data consent, configured conversion action and supported click ID, it uploads an offline click conversion to Google Ads.
- Manual conversion event capture and retryable upload-status recording.
- Atomic per-workspace shared-provider usage counters, provider hard caps and plan-specific monthly request caps. BYOK keys bypass Anaira shared-provider caps.
- Meta creative source already supports single image, video URL upload and carousel child attachments. This release audits that implementation; live provider certification remains pending.

## New migration
`supabase/migrations/20261114235900_growth_google_ads_attribution_metering_v6924.sql`

Creates tenant-scoped attribution events, lead attribution fields, monthly shared-provider counters, plan-specific limits, and an atomic service-role-only usage RPC.

## Setup
1. In Anaira Developer APIs configure Google OAuth Client ID/Secret, HTTPS OAuth Redirect URI, Google Ads Developer Token, API version (default v26), optional manager customer ID, and monthly hard cap.
2. Add the exact callback URL to the Google OAuth web client: `https://YOUR_APP_DOMAIN/api/growth/google-ads/oauth/callback`.
3. Set server environment variable `GROWTH_OAUTH_STATE_SECRET` to a long random secret. `NEXT_PUBLIC_SITE_URL` or `APP_URL` must match the deployed HTTPS origin if redirect URI is not explicitly set.
4. Apply the v6.92.4 migration to the dedicated Growth Engine Supabase project.
5. In each client workspace open Google Ads, connect the client's Google account, select the accessible customer account, and configure conversion action/customer IDs in Client Workspace Integrations.
6. Set provider hard caps and plan-specific caps in Anaira Developer APIs before enabling shared provider usage.

## Important limits
- Search campaign assets are created paused; owner/manager explicitly activates them.
- Google Ads conversion upload requires a valid enabled `UPLOAD_CLICKS` conversion action, supported click ID, valid conversion timestamp, and explicit ad-user-data consent. Google can reject conversions for account/action configuration, click-age, policy or matching reasons.
- Attribution events without click IDs remain local Anaira revenue attribution; no Google Ads upload is claimed.
- Shared usage is metered in API operation/request units, not provider invoice currency or exact token billing. Per-plan caps are applied atomically per workspace; BYOK usage is not charged against Anaira shared quotas.
- Provider E2E, OAuth consent screen verification, Google Ads developer-token access level, account billing, conversion-action configuration and live ad approval require the real customer/developer accounts.
- No remote Supabase migration was applied in this build environment. Clean Next.js production build remains unverified because dependencies could not be installed in this environment.
