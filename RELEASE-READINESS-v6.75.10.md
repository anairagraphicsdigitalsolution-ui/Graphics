# ANAIRA AI GROWTH ENGINE v6.75.10 — Tenant Lead Routing Fix

## Source changes
- Public lead capture no longer hardcodes the Anaira organization slug.
- If a conversation ID is supplied, the server derives the authoritative organization from that conversation and rejects a conflicting slug.
- First-contact lead forms must provide a valid active organization slug.
- AI Sales Chat accepts an `organizationSlug` prop and sends it to both chat and lead-capture endpoints. Existing Anaira website behavior remains the default.
- Added `verify:growth-tenant-lead` and included it in `verify:all`.

## Verification
- `npm run verify:all`: PASS, including 9 new tenant lead-routing assertions.
- 90 TypeScript/TSX files syntax-checked with zero syntax diagnostics.
- Full `npm install` failed with `EAI_AGAIN` resolving registry.npmjs.org; `next build` remains unverified.
- No database migration required.

## Known blockers remain
- WhatsApp webhook and outbound sending still use deployment-global `WHATSAPP_ORGANIZATION_ID`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`; this is not per-tenant WhatsApp routing.
- No invite/member-role management UI or complete platform Super Admin tenant/subscription console.
- The website widget is configurable by source prop but no self-service embed generator/client-domain installation flow exists yet.
- Live provider E2E, scheduler activation and production build are not certified.
