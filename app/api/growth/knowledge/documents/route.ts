import { NextRequest } from 'next/server';
import { extractKnowledgeText, shouldOcrPdf } from '@/lib/growth-knowledge-extract.js';
import { createKnowledgeEmbeddings, knowledgeEmbeddingModel } from '@/lib/growth-knowledge-embeddings';
import { extractKnowledgeOcr } from '@/lib/growth-knowledge-ocr';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
export const maxDuration = 60;
const BUCKET = 'growth-knowledge-private';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['txt', 'csv', 'md', 'markdown', 'pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png', 'webp']);
const safeName = (value: string) => value.replace(/[\\/\r\n\0]/g, '_').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 160) || 'knowledge.txt';
const chunks = (text: string) => {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\0/g, '').trim();
  const out: string[] = [];
  const size = 1200, overlap = 150;
  for (let start = 0; start < normalized.length && out.length < 500; start += size - overlap) {
    const part = normalized.slice(start, start + size).trim();
    if (part) out.push(part);
  }
  return out;
};
async function access(db: any, userId: string, orgId: string, write = false) {
  return Boolean(orgId)
    && await requireGrowthRole(db, userId, orgId, write ? ['owner', 'manager'] : ['owner', 'manager', 'editor', 'viewer', 'client'])
    && await requireGrowthFeature(db, userId, orgId, 'ai_employee');
}

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const orgId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await access(ctx.db, ctx.userId, orgId)) return apiJson({ error: 'Knowledge Hub access denied.' }, 403);
  const { data, error } = await ctx.db.from('growth_knowledge_documents')
    .select('id,file_name,mime_type,file_size,extraction_status,extraction_method,ocr_model,chunk_count,embedding_status,created_at')
    .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100);
  if (error) return apiJson({ error: 'Knowledge documents are not available. Apply the v6.90.6 migration first.' }, 503);
  return apiJson({ documents: data || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const form = await req.formData();
    const orgId = String(form.get('organizationId') || '');
    const file = form.get('file');
    if (!await access(ctx.db, ctx.userId, orgId, true)) return apiJson({ error: 'Owner or manager Knowledge Hub permission is required.' }, 403);
    if (!(file instanceof File)) return apiJson({ error: 'Choose a TXT, CSV, Markdown, PDF, DOCX, XLSX, JPG, PNG or WEBP document.' }, 400);
    const extension = file.name.toLowerCase().split('.').pop() || '';
    if (file.size < 1 || file.size > MAX_BYTES || !ALLOWED_EXTENSIONS.has(extension)) return apiJson({ error: 'Supported formats: TXT, CSV, Markdown, PDF, DOCX, XLSX, JPG, PNG and WEBP, maximum 10 MB.' }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    let extracted: { text: string; mimeType: string };
    let extractionMethod: 'native' | 'ocr' = 'native';
    let ocrModel: string | null = null;
    const imageMime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const mimeType = imageMime[extension] || (extension === 'pdf' ? 'application/pdf' : extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : extension === 'csv' ? 'text/csv' : extension === 'md' || extension === 'markdown' ? 'text/markdown' : 'text/plain');
    try {
      if (mimeType.startsWith('image/')) {
        const ocr = await extractKnowledgeOcr(ctx.db, { bytes, fileName: file.name, mimeType, organizationId: orgId });
        extracted = { text: ocr.text, mimeType }; extractionMethod = 'ocr'; ocrModel = ocr.model;
      } else {
        try { extracted = extractKnowledgeText(bytes, file.name); }
        catch (error) {
          const shouldOcr = extension === 'pdf' && error instanceof Error && /scanned PDFs require OCR|No searchable text/i.test(error.message);
          if (!shouldOcr) throw error;
          const ocr = await extractKnowledgeOcr(ctx.db, { bytes, fileName: file.name, mimeType, organizationId: orgId });
          extracted = { text: ocr.text, mimeType }; extractionMethod = 'ocr'; ocrModel = ocr.model;
        }
        if (extension === 'pdf' && shouldOcrPdf(bytes, extracted.text)) {
          const ocr = await extractKnowledgeOcr(ctx.db, { bytes, fileName: file.name, mimeType, organizationId: orgId });
          extracted = { text: ocr.text, mimeType }; extractionMethod = 'ocr'; ocrModel = ocr.model;
        }
      }
    } catch (error) {
      return apiJson({ error: error instanceof Error ? error.message : 'Document text extraction failed.' }, 400);
    }
    const text = extracted.text;
    const parts = chunks(text);
    if (!parts.length) return apiJson({ error: 'No searchable text could be extracted.' }, 400);
    const id = crypto.randomUUID(), name = safeName(file.name), path = `${orgId}/${id}-${name}`;
    const { error: uploadError } = await ctx.db.storage.from(BUCKET).upload(path, bytes, { contentType: extracted.mimeType, upsert: false });
    if (uploadError) return apiJson({ error: 'Private Knowledge Hub upload failed. Confirm the v6.90.6 migration is applied.' }, 503);
    const { data: doc, error: docError } = await ctx.db.from('growth_knowledge_documents').insert({
      id, organization_id: orgId, file_name: name, mime_type: extracted.mimeType, file_size: file.size,
      storage_path: path, extraction_status: 'indexed', extraction_method: extractionMethod, ocr_model: ocrModel, chunk_count: parts.length, embedding_status: 'pending', uploaded_by: ctx.userId
    }).select('id,file_name,mime_type,file_size,extraction_status,extraction_method,ocr_model,chunk_count,embedding_status,created_at').single();
    if (docError || !doc) { await ctx.db.storage.from(BUCKET).remove([path]); return apiJson({ error: 'Document metadata could not be saved.' }, 500); }
    const embeddingResult = await createKnowledgeEmbeddings(ctx.db, orgId, parts).catch((error) => ({ embeddings: null, model: knowledgeEmbeddingModel, reason: error instanceof Error ? error.message : 'embedding_failed' }));
    const rows = parts.map((content, chunk_index) => ({ organization_id: orgId, document_id: id, chunk_index, content, ...(embeddingResult.embeddings ? { embedding: embeddingResult.embeddings[chunk_index], embedding_model: embeddingResult.model, embedded_at: new Date().toISOString() } : {}) }));
    const { error: chunkError } = await ctx.db.from('growth_knowledge_chunks').insert(rows);
    if (chunkError) {
      await ctx.db.from('growth_knowledge_documents').delete().eq('id', id).eq('organization_id', orgId);
      await ctx.db.storage.from(BUCKET).remove([path]);
      return apiJson({ error: 'Document indexing failed; the upload was rolled back.' }, 500);
    }
    const embeddingStatus = embeddingResult.embeddings ? 'complete' : 'failed';
    await ctx.db.from('growth_knowledge_documents').update({ embedding_status: embeddingStatus }).eq('id', id).eq('organization_id', orgId);
    return apiJson({ document: { ...doc, embedding_status: embeddingStatus }, message: `Document indexed into ${parts.length} searchable chunks.`, semanticSearch: Boolean(embeddingResult.embeddings), semanticSearchNote: embeddingResult.embeddings ? 'Semantic embeddings are ready.' : 'Document remains searchable with full-text retrieval; configure OpenAI embeddings and re-index to enable semantic retrieval.', extractionMethod, ocrModel }, 201);
  } catch (error) {
    return apiJson({ error: error instanceof TypeError ? 'Document must be valid UTF-8 text.' : 'Invalid Knowledge Hub upload.' }, 400);
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json(), orgId = String(body.organizationId || ''), documentId = String(body.documentId || '');
    if (!documentId || !await access(ctx.db, ctx.userId, orgId, true)) return apiJson({ error: 'Owner or manager permission is required.' }, 403);
    const { data: doc } = await ctx.db.from('growth_knowledge_documents').select('id,storage_path')
      .eq('id', documentId).eq('organization_id', orgId).maybeSingle();
    if (!doc) return apiJson({ error: 'Knowledge document not found.' }, 404);
    const { error: storageError } = await ctx.db.storage.from(BUCKET).remove([doc.storage_path]);
    if (storageError) return apiJson({ error: 'Private document could not be removed.' }, 500);
    const { error } = await ctx.db.from('growth_knowledge_documents').delete().eq('id', documentId).eq('organization_id', orgId);
    if (error) return apiJson({ error: 'Document record could not be removed.' }, 500);
    return apiJson({ success: true });
  } catch { return apiJson({ error: 'Invalid document delete request.' }, 400); }
}
