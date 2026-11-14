# Anaira Website v6.87.5 — Vyapar Premium Partner Page

## Updates
- Added configurable Vyapar Partner hero image with Supabase Storage upload support.
- Added editable hero eyebrow, heading and description.
- Added independent hero overlay colour and strength controls.
- Added separate eyebrow, heading and description text colour controls.
- Added hero image position selector and live preview in Website Admin.
- Refined Vyapar Partner page with a premium editorial layout, refined spacing, gold accents and elevated content panels.
- Changed promotional media presentation to a two-column grid on desktop and two compact cards per row on mobile.
- Preserved existing promotional media headings, descriptions, purchase referral links, pricing table and partner certificate.
- Existing settings are stored in `site_settings` and media uploads use the existing `portfolio-media` Supabase Storage bucket.

## Admin path
Website Admin → Website Settings & Text → Vyapar Partner → Premium Hero Image & Appearance.

Upload the hero image, adjust colours and overlay, then click **Save Website Settings** to publish.

## Verification
- TypeScript/TSX syntax: 161 files, 0 syntax errors.
- Website page hero checks: 8/8 passed.
- Gallery regression checks: 9/9 passed.
- Full Next.js production build not run because dependencies are not installed in this ZIP workspace.
