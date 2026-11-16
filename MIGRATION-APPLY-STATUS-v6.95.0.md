# Module 5 Supabase migration status — v6.95.0

- Supabase project: `nrsdqrqkffhbicfskilb`
- Migration: `growth_ai_content_studio_foundation_v6950`
- Live migration version: `20261115144751`
- Apply result: success

## Live catalog verification
- `growth_content` contains the structured content, brand snapshot, approval and publication lifecycle columns.
- `growth_content_templates` exists with member-read / manager-write RLS policies.
- `growth_content_publication_events` exists with RLS enabled and no direct `anon` / `authenticated` grants; service role has explicit access.
- Calendar and content status indexes were created by the migration.
- `growth_content` content-type constraint now permits post, reel, story, carousel, article, ad_copy, blog, seo, product and festival.

## Notes
- Migration is additive; existing content rows and status values are preserved.
- No existing production content was inserted, updated or deleted as part of this migration.
