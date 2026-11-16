import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { retrieveKnowledgeChunks } from '@/lib/growth-knowledge-embeddings';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json(), organizationId = String(body.organizationId || '').trim();
    const query = String(body.query || '').trim().slice(0, 500);
    if (!organizationId || query.length < 2) return apiJson({ error: 'Workspace and a search query of at least 2 characters are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor','viewer','client'])
      || !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'ai_employee')) return apiJson({ error: 'Knowledge Hub access denied.' }, 403);
    const safeQuery = query.replace(/[&|!():*<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (safeQuery.length < 2) return apiJson({ error: 'Enter searchable words.' }, 400);
    const retrieval = await retrieveKnowledgeChunks(ctx.db, organizationId, safeQuery, 8);
    if ((retrieval as any).error) return apiJson({ error: 'Knowledge search is unavailable. Confirm the Knowledge Hub migrations are applied.' }, 503);
    return apiJson({ query, retrieval: (retrieval as any).mode, results: ((retrieval as any).data || []).map((row: any) => ({
      chunkId: row.id, documentId: row.document_id, chunkIndex: row.chunk_index,
      excerpt: row.content, similarity: row.similarity ?? null,
      citation: { documentId: row.document_id, fileName: row.file_name || row.document?.file_name, mimeType: row.mime_type || row.document?.mime_type }
    })) });
  } catch { return apiJson({ error: 'Invalid Knowledge Hub search request.' }, 400); }
}
