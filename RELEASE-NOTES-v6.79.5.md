# Anaira AI Growth Engine v6.79.5

## This release
- Adds CRM lead attachments using a private Supabase Storage bucket.
- Adds tenant- and lead-scoped attachment listing with 2-minute signed download URLs.
- Adds authenticated upload and delete APIs; editor/manager/owner roles are required for mutations.
- Enforces an allow-list of document/image MIME types and a 10 MB maximum per file.
- Adds Customer 360 attachment upload, download and delete controls.
- Adds migration `20261110010000_growth_crm_private_attachments_v6795.sql`.

## Apply before use
1. Apply the new Supabase migration.
2. Ensure `SUPABASE_SERVICE_ROLE_KEY`, Supabase URL and public auth key are configured in Vercel.
3. Deploy v6.79.5 and test with two different workspaces to confirm isolation.

## Verification
- `npm run verify:all`: PASS.
- 124 TS/TSX files syntax-checked; 0 syntax errors.
- CRM attachment regression: 8/8 PASS.
- Next.js production build was not run: this working directory has no installed `next` executable (`next: not found`).
- Live Supabase storage, Vercel deployment, and real user cross-tenant tests have not been performed.

This release completes CRM file attachment functionality at source level only; it does not certify the entire SaaS platform for production.
