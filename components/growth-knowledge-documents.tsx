'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Doc = { id: string; file_name: string; mime_type: string; file_size: number; extraction_status: string; extraction_method?: string; ocr_model?: string | null; chunk_count: number; embedding_status?: string; created_at: string };
type Hit = { chunkId: string; documentId: string; chunkIndex: number; excerpt: string; citation: { fileName: string; mimeType: string } };
type GroundedAnswer = { answer: string; citations: { sourceId: string; documentId: string; chunkId: string; fileName: string; quote: string; excerpt: string }[]; insufficientEvidence: boolean; retrieval: string };
export default function GrowthKnowledgeDocuments({ organizationId }: { organizationId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]), [query, setQuery] = useState(''), [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);
  const [evalCases, setEvalCases] = useState(`[\n  {\n    \"query\": \"What services does this business provide?\",\n    \"expectedDocumentIds\": [\"PASTE_DOCUMENT_ID_HERE\"]\n  }\n]`);
  const [evaluation, setEvaluation] = useState<any>(null);
  const auth = useCallback(async () => { const { data: { session } } = await supabase!.auth.getSession(); return session?.access_token || ''; }, []);
  const load = useCallback(async () => {
    if (!supabase) return;
    const response = await fetch(`/api/growth/knowledge/documents?organizationId=${encodeURIComponent(organizationId)}`, { headers: { Authorization: `Bearer ${await auth()}` } });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Documents could not be loaded.');
    setDocs(data.documents || []);
  }, [organizationId, auth]);
  useEffect(() => { load().catch(error => setNotice(error.message)); }, [load]);
  async function upload(file?: File) {
    if (!file) return; setBusy(true); setNotice('');
    try { const form = new FormData(); form.set('organizationId', organizationId); form.set('file', file);
      const response = await fetch('/api/growth/knowledge/documents', { method: 'POST', headers: { Authorization: `Bearer ${await auth()}` }, body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Upload failed.');
      setNotice(data.message); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Upload failed.'); } finally { setBusy(false); }
  }
  async function search(e: React.FormEvent) { e.preventDefault(); setBusy(true); setNotice('');
    try { const response = await fetch('/api/growth/knowledge/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ organizationId, query }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Search failed.'); setHits(data.results || []); if (!data.results?.length) setNotice('No matching passages found in this workspace knowledge.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Search failed.'); } finally { setBusy(false); }
  }
  async function askKnowledge() { setBusy(true); setNotice(''); setAnswer(null);
    try { const response = await fetch('/api/growth/knowledge/answer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ organizationId, question: query }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Grounded answer failed.'); setAnswer(data as GroundedAnswer);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Grounded answer failed.'); } finally { setBusy(false); }
  }
  async function reindex() { setBusy(true); setNotice('');
    try { const response = await fetch('/api/growth/knowledge/reindex', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ organizationId, limit: 64 }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Re-indexing failed.'); setNotice(data.message || `Embedded ${data.processed || 0} passages.`); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Re-indexing failed.'); } finally { setBusy(false); }
  }
  async function evaluateRetrieval() { setBusy(true); setNotice(''); setEvaluation(null);
    try { const cases = JSON.parse(evalCases); if (!Array.isArray(cases)) throw new Error('Evaluation input must be a JSON array.');
      const response = await fetch('/api/growth/knowledge/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ organizationId, cases }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Retrieval evaluation failed.'); setEvaluation(data); setNotice('Retrieval evaluation completed and saved.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Retrieval evaluation failed.'); } finally { setBusy(false); }
  }
  async function remove(id: string) { if (!window.confirm('Permanently delete this document and all indexed passages?')) return; setBusy(true);
    try { const response = await fetch('/api/growth/knowledge/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ organizationId, documentId: id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Delete failed.'); setHits(old => old.filter(hit => hit.documentId !== id)); await load(); setNotice('Document and indexed passages deleted.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Delete failed.'); } finally { setBusy(false); }
  }
  return <section className="growth-panel">
    <div className="growth-panel-head"><div><h3>Knowledge Hub · Documents</h3><p>Upload workspace reference material, index text into searchable passages and retrieve source-labelled excerpts.</p></div><label className="btn btn-small" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>Upload document<input type="file" accept=".txt,.csv,.md,.markdown,.pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp,text/plain,text/csv,text/markdown,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} hidden onChange={event => { const file = event.target.files?.[0]; void upload(file); event.currentTarget.value = ''; }} /></label></div>
    <p className="growth-muted">Private tenant storage · TXT, CSV, Markdown, PDF, DOCX, XLSX and image extraction · maximum 10 MB per file. Scanned PDF and JPG/PNG/WEBP OCR uses the workspace OpenAI connection and AI quota.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <form className="growth-content-form" onSubmit={search}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search business policies, services, FAQs…" maxLength={500}/><button className="btn btn-secondary" disabled={busy || query.trim().length < 2}>Search passages</button><button type="button" className="btn" disabled={busy || query.trim().length < 3} onClick={() => { void askKnowledge(); }}>Ask Knowledge Hub</button></form>
    {answer && <article className="growth-row"><b>AI answer · {answer.insufficientEvidence ? 'Evidence limited' : 'Grounded in workspace documents'}</b><p>{answer.answer}</p><small>Retrieval: {answer.retrieval}</small>{answer.citations.map(citation => <div key={citation.chunkId} className="growth-muted"><b>{citation.fileName}</b>{citation.quote && <p>“{citation.quote}”</p>}<small>Document {citation.documentId} · Chunk {citation.chunkId}</small></div>)}</article>}
    {hits.map(hit => <article className="growth-row" key={hit.chunkId}><b>{hit.citation.fileName} · passage {hit.chunkIndex + 1}</b><p>{hit.excerpt}</p><small>Source citation · {hit.citation.mimeType} · Document {hit.documentId}</small></article>)}
    <article className="growth-row">
      <b>Retrieval quality evaluation</b>
      <p className="growth-muted">Run up to 20 labelled queries. Use the document IDs listed below to identify expected source documents. Metrics measure retrieval ranking, not answer correctness.</p>
      <textarea rows={6} value={evalCases} onChange={event => setEvalCases(event.target.value)} aria-label="Retrieval evaluation test cases JSON" />
      <button className="btn btn-secondary" disabled={busy || !docs.length} onClick={() => { void evaluateRetrieval(); }}>Evaluate retrieval quality</button>
      {evaluation && <div className="growth-row"><b>Evaluation metrics · {evaluation.metrics.testCases} test cases</b><p>Hit Rate@8: {(evaluation.metrics.hitRateAt8 * 100).toFixed(1)}% · MRR@8: {evaluation.metrics.meanReciprocalRankAt8.toFixed(3)} · Recall@8: {(evaluation.metrics.meanRecallAt8 * 100).toFixed(1)}%</p>{evaluation.results.map((item: any, index: number) => <small key={index}>{item.hit ? 'PASS' : 'MISS'} · {item.query} · {item.retrieval} · Rank {item.firstRelevantRank ?? 'not found'}</small>)}</div>}
    </article>
    <div className="growth-panel-head"><h4>Workspace documents ({docs.length})</h4><button className="btn btn-small btn-secondary" disabled={busy || !docs.some(doc => doc.embedding_status !== 'complete')} onClick={() => { void reindex(); }}>Re-index missing embeddings</button></div>
    {docs.map(doc => <article className="growth-row" key={doc.id}><div><b>{doc.file_name}</b><small>Document ID: {doc.id} · {(doc.file_size / 1024).toFixed(1)} KB · {doc.chunk_count} indexed passages · Extraction: {doc.extraction_method || 'native'}{doc.ocr_model ? ` (${doc.ocr_model})` : ''} · Embeddings: {doc.embedding_status || 'unknown'} · {new Date(doc.created_at).toLocaleString()}</small></div><button className="btn btn-small btn-secondary" disabled={busy} onClick={() => remove(doc.id)}>Delete</button></article>)}
    {!docs.length && <p className="growth-empty">No documents uploaded yet.</p>}
  </section>;
}
