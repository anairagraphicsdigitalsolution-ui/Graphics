# Anaira AI Growth Engine v6.84.0 — Growth Operations Extension

## Implemented in this release

- Phase 29: Tenant-scoped campaign/promotion links with HTTPS destination validation, UTM parameters, opaque redirect slugs, click logging and per-workspace click totals.
- Phase 30: Workspace operations-readiness endpoint and UI checklist for AI, Meta Ads, Meta Conversions, WhatsApp text, WhatsApp Calling, email, scheduler and Supabase configuration. The endpoint reports configuration presence only; it does not claim provider-side verification.
- Growth Intelligence now includes promotion link creation, link listing, click totals and operational readiness status.
- Existing Phase 23–25 strategy/prospect/follow-up, Phase 26 paused Meta campaign submission and explicit activation, and Phase 28 workflow scheduler/recovery are preserved.

## Not certified / external prerequisites

- Phase 27 WhatsApp Business Calling is NOT implemented as a live calling engine. It requires Meta Business Calling eligibility/enablement, permissions, phone-number onboarding, call webhooks and SDP/media signalling integration. This release exposes its readiness requirements and does not place calls.
- Meta Ads activation remains owner-confirmed with explicit daily budget cap. No autonomous spend or automatic activation is performed.
- Phase 24 public prospect discovery/enrichment is not enabled; prospect records remain manually sourced.
- Phase 30 is not production certification. Provider permissions, webhook delivery, billing, live tenant tests, load tests and deployment smoke tests remain required.

## Database

Apply `supabase/migrations/20261111150000_growth_promotion_links_phase29.sql` in Supabase SQL Editor. This migration creates tenant-scoped promotion links and click records plus a service-role-only click-recording RPC.

## Verification

Run `npm run verify:all` and `npm run build`. This package includes a focused static verification script for the new promotion and readiness surfaces. Live Meta/WhatsApp provider actions are not tested by static checks.
