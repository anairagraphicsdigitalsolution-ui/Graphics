# Anaira AI Growth Engine v6.94.3 — Knowledge Hub grounded answers

## Implemented in source
- Added `POST /api/growth/knowledge/answer` for workspace-scoped question answering over indexed Knowledge Hub passages.
- Enforces authenticated Growth context, workspace role and `ai_employee` entitlement.
- Retrieves at most eight tenant-scoped PostgreSQL full-text passages and bounds each excerpt before model context.
- Uses the workspace OpenAI integration first, with the server environment key as fallback; consumes the workspace AI message quota before generation.
- Treats retrieved document text as untrusted data and explicitly disallows outside knowledge and prompt instructions embedded in documents.
- Requires structured JSON output with source IDs and exact supporting quotes.
- Validates every citation against the retrieved source allowlist and requires the quote to occur literally in that passage. Uncited/unverifiable answers are replaced with an insufficient-evidence response.
- Logs model token usage and estimated cost.
- Added Knowledge Hub UI action `Ask Knowledge Hub`, while retaining direct passage search and document management.

## Verification
- `npm run verify:all`: 1,088 PASS / 0 FAIL.
- `npm run verify:syntax`: 205 TS/TSX files, 0 syntax errors.
- Migration static audit: PASS; 78 migration files. Audit is lexical/static only.
- `npm run build`: BLOCKED because Next.js is not installed in this workspace (`next: not found`).

## Explicit limitations
- Retrieval is PostgreSQL full-text search, not vector/semantic search. This release does not claim embeddings or pgvector support.
- Live OpenAI request, remote Supabase migration/catalog/RLS verification, provider E2E, browser E2E and deployed production checks have not been run.
- No remote database migrations were applied.
