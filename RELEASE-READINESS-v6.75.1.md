# Anaira AI Growth Engine — v6.75.1 Release Readiness

This is a deployment-readiness patch on top of v6.75. It does not claim that external providers are connected or that production E2E certification has passed.

## Included in this patch
- Completed the `.env.example` inventory for every `process.env.*` variable found in the source, including Google/YouTube, LinkedIn, Meta Conversions API, media bucket and YouTube privacy defaults.
- Set the documented production site URL and exact LinkedIn / YouTube OAuth callback URL patterns.
- Retained the existing WhatsApp webhook route at `/api/growth/whatsapp/webhook`.
- Bumped the package version to `6.75.1`.

## Source validation performed
- `verify-syntax.cjs`: 90 TypeScript/TSX files checked, 0 syntax diagnostics.
- `verify-growth-worker.cjs`: 49/49 static worker, consent, opt-out, tenant-scope, YouTube recovery, LinkedIn publishing and analytics regression assertions passed.
- ZIP integrity check: passed after packaging.

## Build validation limitation
`npm install` timed out while attempting to reach the npm registry. A dependency-backed `next build` and strict project TypeScript check therefore could not be completed. Running global `tsc --noEmit` without project dependencies produced missing-module/type-definition errors (Next.js, React, Supabase and Node typings); those are environment/dependency errors and are not evidence of a clean strict typecheck.

## Remaining work before calling this production-complete

### Owner/provider setup required
1. Add all required server-side variables from `.env.example` to Vercel Production and redeploy.
2. Confirm the actual Meta Graph API version; replace `vXX.X` with the version enabled for the Meta app.
3. Configure Meta OAuth redirect exactly as `https://graphics.anairapos.in/api/growth/meta/callback`.
4. Configure WhatsApp webhook callback `https://graphics.anairapos.in/api/growth/whatsapp/webhook`, verify token, and subscribe to `messages`.
5. Configure Meta messaging webhook `https://graphics.anairapos.in/api/growth/meta/messaging-webhook` and Lead Ads webhook `https://graphics.anairapos.in/api/growth/meta/webhook`; subscribe to the required Page/Instagram events.
6. Configure LinkedIn callback `https://graphics.anairapos.in/api/growth/social-callback/linkedin`.
7. Configure Google/YouTube callback `https://graphics.anairapos.in/api/growth/social-callback/youtube`. Existing YouTube accounts must reconnect to grant `yt-analytics.readonly`.
8. Confirm the Supabase migrations included in `supabase/` are applied to the target project and that the media bucket exists.
9. Confirm Vercel Cron invokes `/api/growth/worker`. The included Hobby-compatible schedule is daily at 03:00 UTC; this is not suitable for near-real-time follow-ups or frequent resumable-upload continuation. Use a trusted external scheduler or a Vercel plan that supports a more frequent schedule for those workflows.

### Feature limitations still present in source
- Meta ad campaign / ad set / ad creative lifecycle has guarded source-level implementation, but live ad-account E2E, rollback testing, conversion attribution validation and spend reporting must be verified with the real ad account.
- Automation workflow execution remains bounded by the supported trigger/action types implemented in the worker; do not assume arbitrary visual branching or every possible trigger is supported.
- Provider publishing and inbound/outbound messaging have not been certified against live Meta, WhatsApp, LinkedIn or Google accounts in this environment.
- LinkedIn support in this build covers single-image and multi-image publishing; do not assume LinkedIn video publishing.
- AI content generation, lead scoring and automated replies must be checked against the live knowledge base and approved business policies before enabling customer-facing automation.

## Production acceptance test
- Logged-out visitor: AI chat creates a conversation, rate limits correctly, and never invents prices.
- Lead capture: lead is stored with source and consent state; no marketing follow-up occurs without explicit consent.
- WhatsApp: inbound message creates/updates conversation; STOP/opt-out is persisted; human handoff suppresses AI replies; outbound delivery respects the 24-hour window and approved templates.
- Instagram/Messenger: inbound webhook signature verification, deduplication, inbox assignment, human reply and provider delivery verified.
- Social publishing: draft → approval → scheduled job → provider publish → final provider ID/status verified on test accounts.
- YouTube: resumable upload recovery and analytics read verified after OAuth reconnect.
- LinkedIn: single-image and multi-image posts verified with an authorized organization/member.
- Ads: create in PAUSED state, review, explicit owner activation, emergency pause and rollback verified with a low-risk test campaign.
- Security: tenant isolation, RLS, role checks, encrypted tokens, webhook signatures, consent and opt-out checks verified.
