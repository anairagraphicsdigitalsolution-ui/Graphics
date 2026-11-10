# Anaira AI Growth Engine v6.79.3 — CRM Pipeline & Bulk Import

## Changes
- Added `proposal` to the CRM lead lifecycle: New → Contacted → Qualified → Proposal → Won/Lost.
- Added tenant-scoped CSV lead import at `POST /api/growth/crm/import`.
- CSV import requires owner/manager role, enforces 1 MB and 500-row limits, parses quoted fields, validates name/contact/email, checks duplicates within the active tenant, and imports records with marketing consent disabled by default.
- Lead imports consume the workspace `leads` quota before insertion and write a platform audit event.
- CRM now provides CSV import, CSV template download, and existing filtered CSV export.
- Main portfolio pages and general Website Settings were not modified.

## Verification
- `npm run verify:all`: PASS.
- 121 TypeScript/TSX files syntax-checked; zero syntax errors.
- CRM import checks: 13/13 PASS.
- Existing worker, scheduler, recovery, security, tenant routing, team, WhatsApp, billing, CRM, inbox and workflow regression suites pass.
- Next.js production build and live CSV API E2E were not run in this environment; dependency installation/build and Vercel deployment remain separate release gates.

## Live platform state
- Connected Supabase project: `nrsdqrqkffhbicfskilb`.
- Current live data snapshot at release preparation: 1 organization, 1 membership, 0 leads, 0 social connections, 0 WhatsApp connections, 0 plans, 0 subscriptions, 0 invitations.
- No live customer records were imported or changed by this source release.
