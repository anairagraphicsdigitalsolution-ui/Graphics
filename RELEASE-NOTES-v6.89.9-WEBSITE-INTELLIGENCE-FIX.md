# Anaira AI Growth Engine v6.89.9 — Website Intelligence Persistence Fix

## Fixed from the reported screenshot
- Applied the missing `growth_website_audits` migration to the connected Anaira Growth Engine Supabase project.
- Added service-role table grants while keeping RLS enabled and denying direct anon/authenticated table access.
- Renamed the local migration file to the exact version recorded by the live Supabase migration history (`20261113180052`), so local and remote migration history align.
- Updated the scan API to report missing-table errors separately from permission/database errors.
- Added safe redirect following with DNS/IP revalidation for every redirect hop and a maximum redirect count.
- Added bounded response-body reads to prevent unbounded homepage, robots.txt and sitemap downloads.
- Fixed robots.txt newline parsing and made the crawler honor a root `Disallow: /` rule for `*` and `AnairaGrowthBot`.
- Improved metadata and canonical-link parsing regardless of HTML attribute order.
- Fixed website selector history refresh so changing websites loads that website's own saved scans.
- Previous scan rows can now reopen their stored report.

## Live Supabase verification
- Migration `growth_website_intelligence_v1` is present in remote migration history at version `20261113180052`.
- `public.growth_website_audits` exists with the expected tenant and website foreign keys.
- RLS is enabled.
- `anon` and `authenticated` direct SELECT privileges are denied.
- `service_role` SELECT and INSERT privileges are granted.
- A verified website record exists for `graphics.anairapos.in` in the connected Growth Engine workspace.

## Validation
- Website Intelligence regression checks cover route security, redirects, bounded downloads, robots parsing, persistence, history, RLS/grants and UI refresh.
- Full `verify:all` and a production build are attempted for this release; their actual outcomes are recorded in the release gate.

## Operational note
The new migration has already been applied to the connected Supabase project. After replacing the local source with this release, restart the local Next.js dev server before testing. Run “Run SEO & health scan”; the audit should now save and appear under “Previous scans”.
