'use strict';
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');
const helper = read('lib/growth-knowledge-embeddings.ts');
const docs = read('app/api/growth/knowledge/documents/route.ts');
const search = read('app/api/growth/knowledge/search/route.ts');
const answer = read('app/api/growth/knowledge/answer/route.ts');
const migration = read('supabase/migrations/20261115180000_growth_knowledge_semantic_retrieval_v6944.sql');
const checks = [
  ['fixed 1536-dimensional embedding model', helper.includes("text-embedding-3-small") && helper.includes('EMBEDDING_DIMENSIONS = 1536')],
  ['embedding provider request bounded by batches', helper.includes('offset += 64') && helper.includes('AbortSignal.timeout(20000)')],
  ['embedding vector validates dimensions and finite values', helper.includes('vector.length !== EMBEDDING_DIMENSIONS') && helper.includes('Number.isFinite')],
  ['workspace credential resolution used', helper.includes("getWorkspaceIntegration(db, organizationId, 'openai')")],
  ['semantic retrieval is tenant-scoped', helper.includes("p_organization_id: organizationId")],
  ['semantic retrieval falls back to full-text', helper.includes("mode: 'postgres_full_text'") && helper.includes("textSearch('search_vector'")],
  ['document ingestion creates embeddings when configured', docs.includes('createKnowledgeEmbeddings(ctx.db, orgId, parts)')],
  ['document embedding state persisted', docs.includes("embedding_status: embeddingStatus")],
  ['search endpoint uses shared semantic retrieval', search.includes('retrieveKnowledgeChunks(ctx.db, organizationId, safeQuery, 8)')],
  ['grounded answer endpoint uses shared semantic retrieval', answer.includes('retrieveKnowledgeChunks(ctx.db, organizationId, safeQuery, 8)')],
  ['retrieval mode disclosed to clients', answer.includes('(retrieval as any).mode') && search.includes('(retrieval as any).mode')],
  ['pgvector extension and vector column declared', migration.includes('create extension if not exists vector') && migration.includes('extensions.vector(1536)')],
  ['tenant scoped vector RPC and similarity threshold', migration.includes('p_organization_id uuid') && migration.includes('p_min_similarity') && migration.includes('c.organization_id = p_organization_id')],
  ['vector RPC restricted to service role', migration.includes('revoke all on function public.match_growth_knowledge_chunks') && migration.includes('to service_role')],
  ['HNSW cosine index declared', migration.includes('using hnsw') && migration.includes('vector_cosine_ops')],
  ['10 MiB DB storage limit aligned to API', migration.includes('file_size <= 10485760') && migration.includes('file_size_limit = 10485760')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`\n${checks.length - failed} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
