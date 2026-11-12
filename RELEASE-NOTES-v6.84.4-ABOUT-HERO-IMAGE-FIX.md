# Anaira AI Growth Engine v6.84.4 — About Hero Image Fix

## Changes
- Separated the About hero image layer from the overlay and content layers so the selected image renders independently and consistently.
- Added a CMS preview for the About hero image in Website Settings → About Page.
- Added a restore-default-image action; uploaded images continue to use the existing Supabase `portfolio-media` bucket.
- Retained existing About page content, CMS storage structure, overlay controls, responsive styling and all other modules.

## Verification
- TypeScript/TSX syntax scan: 141 files, 0 syntax errors.
- About page checks: 8/8 passed.
- Full `npm run verify:all`: passed.
- Production Next.js build was not run.
