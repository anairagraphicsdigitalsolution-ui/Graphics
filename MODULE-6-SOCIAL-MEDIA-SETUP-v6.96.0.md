# Module 6 — Social Media Management Setup

## OAuth configuration
Configure provider app credentials in the tenant Integrations vault or the approved Anaira platform integration fallback:
- Meta: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`.
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`.
- YouTube: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- Public callback base: `NEXT_PUBLIC_SITE_URL`.

Callbacks:
- Meta: `/api/growth/meta/callback`
- LinkedIn: `/api/growth/social-callback/linkedin`
- YouTube: `/api/growth/social-callback/youtube`

Use exact callback URLs in each provider developer console. The Meta app must have approved Page/Instagram scopes for the requested functions. The Meta consent request includes `pages_read_engagement`, `pages_manage_engagement` and `instagram_manage_comments` alongside the existing Page, messaging, publishing and insights scopes. Provider app review/Advanced Access may be required for production customers.

## Using the module
1. Open AI Growth Engine → Social Media.
2. Select the correct client workspace.
3. Connect Meta, LinkedIn or YouTube; Meta discovers authorized Pages and linked Instagram Professional accounts.
4. Run **Check health / refresh token** after connecting and after provider permission changes.
5. Select a Facebook or Instagram account and sync recent posts.
6. Sync comments for those posts; reply only when the connected account has the relevant provider permission.
7. Review the account-specific best-time suggestions after enough post history has synced.
8. Use the integrated Content Studio calendar and unified inbox for publishing workflow and direct messages.

## Security and operational rules
- Social tokens remain encrypted server-side and are never returned by the account-list API.
- All social account, post and comment operations are organization-scoped.
- Public comment replies are restricted to workspace owners, managers and editors, check provider scopes and use an atomic claim to prevent duplicate concurrent sends.
- Disconnect clears the stored encrypted account credential and blocks future publishing through that account.
- A provider health failure is not automatically treated as token expiry unless the provider error indicates invalid/expired authentication.

## Known limitations
- Post analytics, comment sync and public comment replies currently cover Facebook Pages and Instagram Professional accounts only.
- LinkedIn/YouTube account health and OAuth are supported; their post analytics and moderation workflows are not yet implemented here.
- Best-time suggestions are based on observed engagement for posts synced into the workspace. No sufficient sample means no recommendation; no generic times are presented as account-specific data.
- Live publishing, OAuth refresh, inbox delivery, comment replies and provider webhooks require real provider credentials and approved scopes. This source audit is not a provider E2E certification.


## LinkedIn organization analytics source update (v6.106.0)

- Set `LINKEDIN_ORGANIZATION_ANALYTICS_ENABLED=true` only after the LinkedIn app has the required organization analytics API product access.
- Set `LINKEDIN_API_VERSION` to a currently supported LinkedIn Marketing API version (default in `.env.example`: `202610`).
- Reconnect LinkedIn so the user explicitly grants `r_organization_admin` and `r_organization_social`.
- The OAuth callback records only approved organization URNs returned by LinkedIn organization ACL discovery. The analytics endpoint rejects organization URNs not present in that tenant account's OAuth metadata.
- Request `/api/growth/linkedin-analytics?organizationId=...&socialAccountId=...&organizationUrn=urn%3Ali%3Aorganization%3A...&days=28` using an authenticated workspace session. Supported periods: 7, 28 and 90 days.
- The endpoint refreshes expiring tokens when a refresh token and OAuth client credentials are available, then retrieves organization page, follower and share statistics. Partial provider failures are surfaced as warnings; no provider data is fabricated.
- Migrations `20261116065242_growth_linkedin_analytics_v61600.sql` and `20261116065521_growth_linkedin_analytics_grant_lockdown_v61600b.sql` expands the analytics snapshot table to LinkedIn while keeping direct authenticated writes denied.

**Certification status:** source path and focused static checks pass; LinkedIn API product approval, organization role, OAuth grant, real API response and dashboard UI presentation still require a live LinkedIn test account.
