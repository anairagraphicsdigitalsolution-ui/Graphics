# Anaira AI Growth Engine v6.93.0 — Analytics Accuracy Hardening

## Implemented
- Reworked the Growth Analytics API to page through workspace data rather than silently aggregating only the first PostgREST response page.
- Added bounded pagination (500 rows/page, up to 40 pages per source) to protect the API from unbounded reads.
- Added an explicit `dataQuality` object. If a source reaches the safety cap, the response lists truncated sources and marks totals/ratios as partial.
- Added qualified-lead rate and won-lead rate based on the complete loaded 30-day lead set.
- Added content and campaign grouping by status/platform/channel.
- Added AI usage breakdown by provider, including token units and estimated cost.
- Preserved currency-separated attribution revenue totals.
- Explicitly returns CPL, CAC and ROAS as unavailable (`null`) until reconciled channel spend and campaign-level revenue data are available. This avoids presenting fabricated unit economics.
- Existing workspace role checks, CRM entitlement checks and organization filters remain in place.

## Verification
- Added `scripts/verify-growth-analytics-v6930.cjs` with 11 source-level regression checks.
- `npm run verify:all`: 922 PASS, 0 FAIL. The TypeScript/TSX syntax scan checked 198 files with zero syntax errors. New analytics regression checks: 12/12 PASS.
- Production build and live database/provider certification are not claimed by this source update.

## Not certified
- Clean dependency installation and Next.js production build (the v6.92.9 archive had no lockfile and `next` was unavailable).
- Live Supabase pagination/query performance and RLS isolation under two real tenants.
- Reconciliation of ad spend and customer revenue required for CPL/CAC/ROAS.
- Live provider E2E and browser-based end-to-end acceptance for all 15 modules.
