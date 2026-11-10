# Anaira AI Growth Engine v6.81.3 — Contact Us Hero Studio

## Changes
- Added a configurable hero section to the public Contact Us page.
- Added Admin → Website Settings → Contact Us Hero controls.
- Supports hero enable/disable, image URL and Supabase Storage upload/replace/remove, eyebrow/title/description text, independent text colours, overlay colour/opacity, and image focal position.
- Contact page continues to use the existing shared `site_settings` record and existing contact form, map, phone, WhatsApp and enquiry flow remain intact.
- Existing shared PageHero now accepts an optional image position; existing callers retain the default centred position.

## Verification
- `npm run verify:contact-hero` checks the contact hero data flow and admin controls.
- Run `npm run verify:all` and `npm run build` in the deployment environment before production release.
- Live Supabase upload and production rendering are not certified by source checks alone.
