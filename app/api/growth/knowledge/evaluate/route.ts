import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { retrieveKnowledgeChunks } from '@/lib/growth-knowledge-embeddings';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Owner/manager retrieval evaluation against explicitly-labelled documents in this tenant only. */
export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '').trim();
    const cases = Array.isArray(body.cases) ? body.cases.slice(0, 20) : [];
    if (!organizationId || !cases.length) return apiJson({ error: 'Workspace and at least one labelled test case are required.' }, 400);
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])
      || !await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'ai_employee')) {
      return apiJson({ error: 'Owner or manager Knowledge Hub permission is required.' }, 403);
    }
    const normalized = cases.map((item: any) => ({
      query: String(item?.query || '').trim().slice(0, 500),
      expectedDocumentIds: Array.isArray(item?.expectedDocumentIds) ? [...new Set(item.expectedDocumentIds.map((id: any) => String(id).trim()).filter(Boolean))].slice(0, 10) : [],
    }));
    if (normalized.some((item: any) => item.query.length < 2 || !item.expectedDocumentIds.length)) {
      return apiJson({ error: 'Every test case needs a query (2+ characters) and at least one expected document ID.' }, 400);
    }
    const allExpected: string[] = [...new Set<string>(normalized.flatMap((item: any): string[] => item.expectedDocumentIds as string[]))];
    const { data: documents, error: docError } = await ctx.db.from('growth_knowledge_documents')
      .select('id,file_name').eq('organization_id', organizationId).in('id', allExpected);
    if (docError) return apiJson({ error: 'Expected document labels could not be validated.' }, 503);
    const owned = new Set<string>((documents || []).map((doc: any) => String(doc.id)));
    if (allExpected.some((id: string) => !owned.has(id))) return apiJson({ error: 'Every expected document must belong to this workspace.' }, 400);

    const results: any[] = [];
    let hits = 0, reciprocalRankTotal = 0, recallTotal = 0;
    for (const item of normalized) {
      const retrieval = await retrieveKnowledgeChunks(ctx.db, organizationId, item.query, 8) as any;
      if (retrieval.error) return apiJson({ error: 'Knowledge retrieval failed during evaluation.' }, 503);
      const rows = Array.isArray(retrieval.data) ? retrieval.data : [];
      const rankedDocumentIds = rows.map((row: any) => String(row.document_id));
      const expected = new Set(item.expectedDocumentIds);
      const matched = [...new Set(rankedDocumentIds.filter((id: string) => expected.has(id)))];
      const firstRank = rankedDocumentIds.findIndex((id: string) => expected.has(id));
      const recall = matched.length / expected.size;
      if (firstRank >= 0) { hits++; reciprocalRankTotal += 1 / (firstRank + 1); }
      recallTotal += recall;
      results.push({ query: item.query, expectedDocumentIds: item.expectedDocumentIds, rankedDocumentIds, matchedDocumentIds: matched, hit: firstRank >= 0, firstRelevantRank: firstRank < 0 ? null : firstRank + 1, recallAt8: Number(recall.toFixed(4)), retrieval: retrieval.mode });
    }
    const count = normalized.length;
    const metrics = { testCases: count, hitRateAt8: Number((hits / count).toFixed(4)), meanReciprocalRankAt8: Number((reciprocalRankTotal / count).toFixed(4)), meanRecallAt8: Number((recallTotal / count).toFixed(4)) };
    const { data: saved, error: saveError } = await ctx.db.from('growth_knowledge_retrieval_evaluations').insert({
      organization_id: organizationId, created_by: ctx.userId, metrics, test_cases: results,
    }).select('id,created_at').single();
    if (saveError) return apiJson({ error: 'Evaluation ran but its audit record could not be saved.' }, 503);
    return apiJson({ success: true, evaluationId: saved.id, createdAt: saved.created_at, metrics, results, note: 'Metrics use the expected document labels you supplied. They evaluate retrieval ranking, not answer correctness.' });
  } catch {
    return apiJson({ error: 'Invalid Knowledge Hub evaluation request.' }, 400);
  }
}
