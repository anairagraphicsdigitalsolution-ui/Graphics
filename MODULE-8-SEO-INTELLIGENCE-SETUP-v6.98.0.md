# Module 8 — SEO Intelligence (v6.98.0)

## Delivered
- Tenant-scoped Google OAuth connection for Search Console and GA4 using the platform's encrypted Google OAuth Developer App credentials.
- Signed, expiring, HttpOnly OAuth state cookie and callback-side tenant membership revalidation.
- Workspace refresh tokens stored AES-256-GCM encrypted in `growth_integrations` under provider `google_seo`.
- Per-website Search Console and GA4 property selection.
- Search Console Search Analytics sync for date, query, page, country and device dimensions.
- GA4 Data API sync for date, landing page, source/medium, sessions, engaged sessions, users and conversions.
- Tracked keyword list with current and prior-period Search Console average position, clicks, impressions and CTR.
- SEO task generation from failed homepage audit checks, with task status workflow.
- Existing homepage SEO audit and history retained, including DNS ownership verification and SSRF/robots protections.
- Tenant-scoped RLS for keyword, metrics and task tables.

## Activate Google OAuth
1. In Anaira Super Admin → Developer APIs, configure the Google OAuth Developer App client ID and client secret.
2. Set **SEO OAuth Redirect URI** to `https://YOUR-APP-DOMAIN/api/growth/seo/oauth/callback`.
3. Add that exact URL under the Google Cloud OAuth client's Authorized redirect URIs.
4. Enable Google Search Console API, Google Analytics Admin API and Google Analytics Data API in the Google Cloud project.
5. Configure the OAuth consent screen and allow the required account(s) to authorize the app.
6. In the workspace, open SEO Intelligence, connect Google, load available properties, select the Search Console and GA4 property for each website, and save.
7. Run Search Console and GA4 sync. Data appears only after Google returns it successfully.

Requested OAuth scopes are read-only:
- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`

## Ranking terminology and limitations
- “Position” is Google Search Console's average position aggregated across the selected date window and dimensions. It is not a real-time or guaranteed exact SERP rank.
- Search Console reporting has provider-side data latency. The sync excludes the latest three days and queries a 28-day window plus the preceding 28-day comparison window.
- Keyword tracking currently starts from user-entered target keywords and verifies them against actual Search Console query rows. It does not invent search volume or rank when Google has no row.
- Third-party SERP rank collection, competitor keyword visibility, automatic keyword discovery, and competitor share-of-voice are not enabled in this release.
- Multi-page crawling, scheduled crawl/provider sync, automatic page metadata/schema edits and publishing are not enabled in this release. Existing website scan remains a homepage audit.
- Task generation creates work items from failed audit checks; it does not change website pages.

## Live activation state at packaging
- Supabase migrations applied: `20261116043326_growth_seo_intelligence_v6980`, `20261116043535_growth_seo_integration_provider_v6980b`, and `20261116043810_growth_seo_privilege_lockdown_v6980c`.
- Four SEO tables verified in the live project with RLS enabled and tenant policies.
- The connected Supabase project currently has no `google_oauth_app` row. Therefore OAuth and provider data sync cannot be live-tested until the Google OAuth Developer App is configured.
- Build is not certified: `npm run build` returns `next: not found` because this workspace has no installed Next.js dependencies.
