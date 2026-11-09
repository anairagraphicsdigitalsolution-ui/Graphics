# Anaira Graphics & Digital Solution — Full App Audit
Audit basis: supplied v6.29 source ZIP and build logs shared on 8 Nov 2026.

## Scope inspected
- 18 App Router page/route files, including Admin, contact API, legal pages and dynamic project details
- Shared components and library modules
- Supabase schema and all migration files
- Package configuration, environment example, README and local public assets

## Fixes applied in this audit build
1. Removed a duplicate `industry` property in the `anaira-pos` case-study object.
2. Resolved the duplicate Supabase migration version timestamp by moving the services migration to `20261108000150`.
3. Corrected contact-form delivery reporting:
   - `delivery=sent` only when Resend accepts the email.
   - `delivery=saved` when Supabase saves the enquiry but email is not sent.
   - error state when neither destination confirms receipt.
   - Contact page now displays the actual outcome rather than always claiming the enquiry was received.

## Checks completed
- 31 TypeScript/TSX files transpile with zero syntax diagnostics.
- `lib/data.ts`, `lib/about-content.ts`, and `lib/studio-content.ts` pass isolated TypeScript checking.
- Local static image references checked: no missing referenced assets found.
- Invalid hero customization props on `<img>` / `ProjectGrid` and malformed `divclassName` patterns: none found.
- Public source scan: no service-role key or hard-coded Resend API key found.
- Supabase migration filenames now have unique ordered versions.
- ZIP integrity verified after packaging.

## Findings still requiring live credentials or browser testing
1. A full Next.js production build was not completed in this environment: `npm install` timed out. Run `npm install` and `npm run build` on the project machine to complete dependency-backed validation.
2. Supabase login, RLS permissions, Storage uploads, CMS save/delete, and public content refresh require testing against the live Supabase project. This source audit cannot prove the remote policies or bucket are currently applied.
3. Email delivery requires `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` in Vercel/local environment.
4. The contact endpoint currently uses a honeypot and input-length checks; there is no server-side rate limiter or CAPTCHA integration in this source.
5. Header/footer contact details are partly hard-coded in the shared shell rather than consistently sourced from CMS settings. Confirm intended behaviour before relying on Admin edits to update every visible contact detail.
6. The public projects read policy exposes every row in `projects`; there is no publish/draft visibility column in this schema. Do not store private/unapproved project records in this table.
7. `getPortfolioContent()` falls back to seed content when Supabase queries fail; the public site can look normal while remote CMS data is unavailable. Monitor Supabase errors during live testing.

## Overall status
Source-level audit and targeted fixes completed. This is not a claim of end-to-end production certification. Complete the dependency-backed build and live Supabase/browser checks before treating the app as production-verified.

## AI Growth Engine — v6.45 follow-up audit (2026-11-09)

### Completed in this update
- Atomic database-backed rate limiting on public website AI chat and lead capture.
- Production Supabase migration applied and verified: `growth_public_rate_limits`, RLS enabled, `service_role` execution allowed, `anon` execution denied.
- Verified rate-limit RPC behavior: requests 1 and 2 allowed at limit 2; request 3 denied.
- Facebook Lead Ads webhook route with Meta challenge verification, HMAC signature verification, webhook event deduplication, Page token lead retrieval and CRM insertion with contact consent false.
- Meta OAuth requests `leads_retrieval` permission.
- Approximate INR token cost estimates for known OpenAI models in website chat, WhatsApp AI replies and content generation.
- Source TypeScript/TSX syntax transpilation: 58 files, zero syntax diagnostics.

### Not certified / still external or incomplete
- Full `next build` and strict TypeScript check were not run because dependency installation timed out in this environment; do not treat syntax transpilation as a production build.
- Meta Lead Ads requires Meta app review/permissions, Page webhook subscription, valid callback configuration and user-side test lead.
- Instagram DMs and Facebook Messenger inbox are not implemented. Facebook Lead Ads and WhatsApp text conversations are separate flows.
- Email automation, general visual workflow builder, extra automation triggers, social insights ingestion, paid ad buying/attribution, media upload pipeline, Instagram carousel/Stories, LinkedIn and YouTube publishing remain incomplete.
- Provider API keys and Vercel environment variables are not present in source and must be configured by the owner. No secrets are embedded in the ZIP.
