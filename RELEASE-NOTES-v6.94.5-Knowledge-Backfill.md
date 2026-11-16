# Anaira AI Growth Engine v6.94.5 — Knowledge Hub Embedding Backfill

- Added a tenant-scoped owner/manager API to re-embed existing Knowledge Hub passages in bounded batches of up to 64.
- Reuses the workspace OpenAI credential resolver, AI quota enforcement, vector validation and usage/cost logging.
- Only passages with missing embeddings are selected; updates use a compare-and-set condition so existing vectors are not overwritten.
- Recalculates document embedding status and reports remaining work so the user can repeat batches until complete.
- Added a Knowledge Hub UI action and per-document embedding status display.
- Focused verifier: 14 PASS / 0 FAIL.
- Full `npm run verify:all`: exit 0.
- Syntax scan: 207 TS/TSX files, 0 syntax errors.
- Static migration audit: PASS.
- No new migration required; the endpoint depends on v6.94.4 semantic retrieval schema being applied.
- Live Supabase/OpenAI execution and production build remain unverified. No incremental ZIP was generated per the consolidated-delivery requirement.
