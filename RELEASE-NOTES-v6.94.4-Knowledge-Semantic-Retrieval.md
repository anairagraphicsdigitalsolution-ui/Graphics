# Anaira AI Growth Engine v6.94.4 — Knowledge Hub Semantic Retrieval

## Source changes
- Added OpenAI `text-embedding-3-small` embeddings (1536 dimensions) for Knowledge Hub chunks.
- Added bounded batches (64 passages/request), vector dimension/finite-number validation, workspace credential resolution, AI quota consumption and usage/cost logging.
- Added tenant-scoped pgvector cosine retrieval RPC with similarity threshold and HNSW index.
- Knowledge search and grounded-answer endpoints now prefer semantic retrieval and fall back to PostgreSQL full-text retrieval when embeddings are unavailable or the vector RPC cannot run.
- Document ingestion records `embedding_status`; documents remain searchable through full-text retrieval when embedding generation is unavailable.
- Aligned database/storage upload limit to the API's 10 MiB limit.

## Migration
`supabase/migrations/20261115180000_growth_knowledge_semantic_retrieval_v6944.sql`

The migration requires the Supabase `vector` extension. Apply migrations in order to the dedicated Growth Engine project. This source package does not apply remote migrations.

## Verification
- `npm run verify:all`: 1,104 individual PASS assertions, 0 FAIL assertions.
- `npm run verify:syntax`: 206 TS/TSX files, 0 syntax errors.
- `npm run audit:growth-migrations`: PASS (static source audit only).
- ZIP integrity: verified after packaging.

## Explicit limitations
- OCR for scanned PDFs/images is not implemented in this release.
- Existing documents need a re-index/backfill operation to receive embeddings; newly uploaded documents are embedded when OpenAI is configured and quota is available.
- Production build is blocked in this environment because Next.js is not installed (`next: not found`).
- Remote Supabase migration, vector extension availability, live provider calls, tenant adversarial tests, and browser E2E remain unverified.
- This is a Knowledge Hub source increment, not a claim that all 15 modules are production-certified.
