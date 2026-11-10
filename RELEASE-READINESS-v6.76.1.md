# ANAIRA AI Growth Engine v6.76.1 — Tenant WhatsApp Routing Update

## Scope
Continues from v6.76.0. Changes are limited to AI Growth Engine source. Main portfolio pages and general website settings were not intentionally modified.

## Implemented in source
- Tenant WhatsApp connection table with one verified WhatsApp Business phone number per organization.
- Owner-only connect/disconnect API.
- Meta Graph API verification of the submitted phone-number ID before saving credentials.
- Access token encrypted at rest with the existing AES-256-GCM `growth-crypto` helper.
- Browser API returns connection metadata only; encrypted credentials are never selected for the UI response.
- WhatsApp channel UI for connecting and disconnecting a tenant's phone number.
- Incoming webhook maps `metadata.phone_number_id` to the exact connected organization.
- Outbound lead messages, human inbox replies, worker text follow-ups and approved-template jobs resolve credentials by organization.
- Direct free-form outbound messages now require active consent, no opt-out, a linked conversation and an open 24-hour customer-service window.
- WhatsApp AI prompt and opt-out acknowledgement are tenant/business neutral and use the resolved organization's brand profile and knowledge base.
- Worker pauses queued jobs and workflow runs for suspended organizations instead of executing them.
- Added 11 static assertions for tenant WhatsApp routing and suspended-tenant worker behavior.

## New migration
`supabase/migrations/20261109270000_growth_whatsapp_tenant_connections_v6761.sql`

Apply this migration to the correct Anaira Supabase project before connecting tenant WhatsApp accounts.

## Required server environment
- `GROWTH_TOKEN_ENCRYPTION_KEY`: 32-byte base64 or 64-character hex key. Generate with `openssl rand -base64 32`. Server-only; never use `NEXT_PUBLIC_`.
- `META_APP_SECRET`: validates Meta webhook signatures.
- `WHATSAPP_VERIFY_TOKEN`: Meta webhook subscription verification token.
- `META_GRAPH_API_VERSION`: optional default Graph API version; per-tenant version is stored with the connection.
- Existing Supabase URL and service-role key server-side.
- Existing `OPENAI_API_KEY` for automated WhatsApp AI replies.

Existing global `WHATSAPP_*` environment credentials remain as a backward-compatible fallback only for the exact organization ID configured in `WHATSAPP_ORGANIZATION_ID`. New client workspaces must use the tenant connection screen.

## Verification completed
- `npm run verify:all` passed.
- 109 TS/TSX source files transpile with zero syntax errors.
- Existing Growth worker, scheduler, recovery, security, release, lead-routing, navigation and team checks passed.
- 11 new tenant WhatsApp routing/security assertions passed.
- Source contains 41 Growth API route files and 26 SQL migration files.

## Not certified / still outstanding
- Both v6.76 team invitation/audit migration and v6.76.1 WhatsApp tenant-connection migration were applied to the exact Anaira Supabase project `nrsdqrqkffhbicfskilb` (ACTIVE_HEALTHY, ap-northeast-1). SQL verification confirmed RLS enabled, no anon/authenticated SELECT grants, and service_role SELECT grant on all three new tables.
- Meta webhook subscription, WhatsApp number onboarding and inbound/outbound provider E2E require live Meta app credentials and were not tested. The live database schema is ready, but no tenant WhatsApp credentials have been connected.
- One WhatsApp phone number per organization is supported in this release; multiple phone numbers per tenant need a follow-up schema/UI expansion.
- Subscription checkout, payment reconciliation, plan entitlements and hard usage quotas remain unimplemented.
- Full visual workflow canvas, parallel branches and workflow versioning remain incomplete.
- Full tenant suspension enforcement still needs route-by-route review beyond shared authorization and worker pause behavior.
- Full Next.js production build and live Vercel deployment are not certified.

## Release verdict
Tenant-specific WhatsApp architecture is implemented in source, including encrypted credential storage and webhook routing. It is not live-provider certified. This is a SaaS foundation update, not a declaration that the complete AI Growth SaaS is production-ready.
