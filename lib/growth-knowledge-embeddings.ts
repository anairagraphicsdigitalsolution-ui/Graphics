import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspaceIntegration } from '@/lib/growth-integrations';
import { consumeGrowthQuota } from '@/lib/growth-quota';
import { estimateOpenAICost } from '@/lib/growth-cost';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

async function getEmbeddingKey(db: SupabaseClient, organizationId: string) {
  const integration = await getWorkspaceIntegration(db, organizationId, 'openai');
  return String(integration.credentials.api_key || process.env.OPENAI_API_KEY || '').trim();
}

export async function createKnowledgeEmbeddings(db: SupabaseClient, organizationId: string, texts: string[]) {
  const key = await getEmbeddingKey(db, organizationId);
  if (!key || !texts.length) return { embeddings: null as number[][] | null, model: EMBEDDING_MODEL, reason: key ? 'empty_input' : 'openai_not_configured' };
  const output: number[][] = [];
  // Bounded batches avoid provider payload/time limits for large documents.
  for (let offset = 0; offset < texts.length; offset += 64) {
    const quota = await consumeGrowthQuota(db, organizationId, 'ai_messages', 1, undefined, { operation: 'knowledge_embedding', model: EMBEDDING_MODEL });
    if (!quota.allowed) return { embeddings: null as number[][] | null, model: EMBEDDING_MODEL, reason: 'workspace_ai_quota_exceeded' };
    const batch = texts.slice(offset, offset + 64).map((text) => text.slice(0, 8000));
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, input: batch }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) return { embeddings: null as number[][] | null, model: EMBEDDING_MODEL, reason: String(payload.error?.message || 'embedding_provider_error').slice(0, 240) };
    const usage = payload.usage || {};
    const { error: usageError } = await db.from('growth_usage_logs').insert({ organization_id: organizationId, provider: 'openai', model: EMBEDDING_MODEL, operation: 'knowledge_embedding', input_units: usage.prompt_tokens || 0, output_units: 0, estimated_cost: estimateOpenAICost(EMBEDDING_MODEL, usage.prompt_tokens || 0, 0) });
    if (usageError) console.error('[growth-knowledge-embeddings] Usage log insert failed', usageError.message);
    const rows = Array.isArray(payload.data) ? payload.data : [];
    if (rows.length !== batch.length) return { embeddings: null as number[][] | null, model: EMBEDDING_MODEL, reason: 'embedding_count_mismatch' };
    for (const row of rows.sort((a: any, b: any) => Number(a.index) - Number(b.index))) {
      const vector = Array.isArray(row.embedding) ? row.embedding.map(Number) : [];
      if (vector.length !== EMBEDDING_DIMENSIONS || vector.some((n: number) => !Number.isFinite(n))) return { embeddings: null as number[][] | null, model: EMBEDDING_MODEL, reason: 'invalid_embedding_vector' };
      output.push(vector);
    }
  }
  return { embeddings: output, model: EMBEDDING_MODEL, reason: null as string | null };
}

export async function retrieveKnowledgeChunks(db: SupabaseClient, organizationId: string, query: string, limit = 8) {
  const generated = await createKnowledgeEmbeddings(db, organizationId, [query]);
  if (generated.embeddings?.[0]) {
    const { data, error } = await db.rpc('match_growth_knowledge_chunks', {
      p_organization_id: organizationId, p_embedding: generated.embeddings[0], p_match_count: limit, p_min_similarity: 0.18,
    });
    if (!error && Array.isArray(data) && data.length) return { data, mode: 'hybrid_semantic', semantic: true };
  }
  const safeQuery = query.replace(/[&|!():*<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const { data, error } = await db.from('growth_knowledge_chunks')
    .select('id,document_id,chunk_index,content,document:growth_knowledge_documents!inner(id,file_name,mime_type,created_at)')
    .eq('organization_id', organizationId).textSearch('search_vector', safeQuery, { type: 'websearch', config: 'simple' }).limit(limit);
  return { data: data || [], error, mode: 'postgres_full_text', semantic: false };
}

export const knowledgeEmbeddingModel = EMBEDDING_MODEL;
