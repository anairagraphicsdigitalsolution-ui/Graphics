# Anaira AI Growth Engine v6.87.6 — Vyapar Premium & Navigation Repair

## Changes
- Added a shared `/admin/ai-growth` route layout so the Growth navigation is present consistently across dedicated module pages, not only the overview dashboard.
- Removed duplicate per-component navigation mounts to prevent overlapping sidebars.
- Desktop: fixed left sidebar at wide CSS viewports.
- Tablet/mobile and high-zoom narrow CSS viewports: fixed bottom navigation with a More drawer and safe-area padding.
- Platform administrators can see the workspace module navigation even when they do not have a separate `growth_members` row; authorization/data access remains enforced by existing route/API checks and RLS.
- Vyapar hero image upload, hero copy, text colours, overlay colour/opacity and image positioning are editable in Admin → Website Settings & Text → Vyapar Partner.
- Vyapar promotions are compact cards in a two-column grid, including mobile, with smaller image areas and responsive typography.

## Verification
- TypeScript/TSX syntax: 162 files, 0 syntax errors.
- Growth shell checks: 10/10 PASS.
- Growth navigation checks: 13/13 PASS after updating the assertion for the shared route layout.
- Responsive UI checks: 8/8 PASS.
- Full production build not run in this environment; dependencies are not installed in the uploaded source directory.
