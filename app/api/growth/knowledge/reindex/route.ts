import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { createKnowledgeEmbeddings, knowledgeEmbeddingModel } from '@/lib/growth-knowledge-embeddings';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MAX_BATCH = 64;

/** Re-embed previously indexed passages in a bounded, tenant-scoped batch. */
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '').trim();
    if (!organizationId
      || !await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])
      || !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'ai_employee')) {
      return apiJson({ error: 'Owner or manager Knowledge Hub permission is required.' }, 403);
    }

    const requested = Number(body.limit || MAX_BATCH);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(MAX_BATCH, Math.floor(requested))) : MAX_BATCH;
    const { data: chunks, error: selectError } = await ctx.db.from('growth_knowledge_chunks')
      .select('id,document_id,content')
      .eq('organization_id', organizationId)
      .is('embedding', null)
      .order('document_id', { ascending: true })
      .order('chunk_index', { ascending: true })
      .limit(limit);
    if (selectError) return apiJson({ error: 'Semantic re-indexing is unavailable. Apply the Knowledge Hub semantic retrieval migration first.' }, 503);
    if (!chunks?.length) {
      return apiJson({ success: true, processed: 0, remaining: 0, complete: true, message: 'All current passages already have embeddings.' });
    }

    const generated = await createKnowledgeEmbeddings(ctx.db, organizationId, chunks.map((row: any) => String(row.content || '')));
    if (!generated.embeddings || generated.embeddings.length !== chunks.length) {
      return apiJson({ error: generated.reason || 'Embedding provider did not return every requested vector.', processed: 0, retryable: true }, 503);
    }

    let processed = 0;
    const affectedDocuments = new Set<string>();
    for (let index = 0; index < chunks.length; index++) {
      const row: any = chunks[index];
      const { data, error } = await ctx.db.from('growth_knowledge_chunks').update({
        embedding: generated.embeddings[index], embedding_model: knowledgeEmbeddingModel, embedded_at: new Date().toISOString(),
      }).eq('id', row.id).eq('organization_id', organizationId).is('embedding', null).select('id');
      if (error) return apiJson({ error: 'Some embeddings were generated but could not be saved. Retry this operation to finish remaining passages.', processed, retryable: true }, 503);
      if (data?.length) { processed++; affectedDocuments.add(String(row.document_id)); }
    }

    for (const documentId of affectedDocuments) {
      const [{ count: total }, { count: missing }] = await Promise.all([
        ctx.db.from('growth_knowledge_chunks').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('document_id', documentId),
        ctx.db.from('growth_knowledge_chunks').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('document_id', documentId).is('embedding', null),
      ]);
      await ctx.db.from('growth_knowledge_documents').update({ embedding_status: (total || 0) > 0 && (missing || 0) === 0 ? 'complete' : 'pending' })
        .eq('id', documentId).eq('organization_id', organizationId);
    }

    const { count: remaining, error: remainingError } = await ctx.db.from('growth_knowledge_chunks')
      .select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).is('embedding', null);
    if (remainingError) return apiJson({ error: 'Embeddings were saved, but remaining-work status could not be calculated.', processed, retryable: true }, 503);
    return apiJson({ success: true, processed, remaining: remaining || 0, complete: (remaining || 0) === 0, message: (remaining || 0) === 0 ? 'Knowledge Hub semantic re-indexing is complete.' : `Embedded ${processed} passages. Run again to process the next batch.` });
  } catch {
    return apiJson({ error: 'Invalid Knowledge Hub re-index request.' }, 400);
  }
}
