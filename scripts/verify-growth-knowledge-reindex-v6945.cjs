'use strict';
const fs = require('node:fs');
const route = fs.readFileSync('app/api/growth/knowledge/reindex/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-knowledge-documents.tsx', 'utf8');
const checks = [
  ['re-index endpoint is POST only', route.includes('export async function POST')],
  ['owner and manager roles required', route.includes("['owner', 'manager']")],
  ['AI employee entitlement checked', route.includes("'ai_employee'")],
  ['workspace filter applied to chunk selection', route.includes(".eq('organization_id', organizationId)")],
  ['only missing embeddings selected', route.includes(".is('embedding', null)")],
  ['re-index batch bounded to 64 chunks', route.includes('const MAX_BATCH = 64') && route.includes('Math.min(MAX_BATCH')],
  ['existing extracted passage content reused', route.includes(".select('id,document_id,content')")],
  ['shared quota-controlled embedding helper reused', route.includes('createKnowledgeEmbeddings(ctx.db, organizationId')],
  ['embedding model and timestamp persisted', route.includes('embedding_model: knowledgeEmbeddingModel') && route.includes('embedded_at:')],
  ['compare-and-set prevents overwriting existing vectors', route.includes(".is('embedding', null).select('id')")],
  ['document embedding state recalculated', route.includes("update({ embedding_status:")],
  ['remaining work count is returned', route.includes(".is('embedding', null);") && route.includes('remaining: remaining || 0')],
  ['UI exposes re-index action', ui.includes("fetch('/api/growth/knowledge/reindex'") && ui.includes('Re-index missing embeddings')],
  ['UI shows embedding status', ui.includes('Embeddings: {doc.embedding_status')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`\n${checks.length - failed} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
