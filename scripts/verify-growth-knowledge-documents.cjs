const fs = require('fs');
const assert = require('assert');
const route = fs.readFileSync('app/api/growth/knowledge/documents/route.ts', 'utf8');
const search = fs.readFileSync('app/api/growth/knowledge/search/route.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261114150000_growth_knowledge_documents_v6906.sql', 'utf8');
const ui = fs.readFileSync('components/growth-knowledge-documents.tsx', 'utf8');
const center = fs.readFileSync('components/growth-control-center.tsx', 'utf8');
const checks = [
  ['documents API requires authenticated growth context', route.includes('growthContext(req)')],
  ['documents API enforces tenant role and feature entitlement', route.includes('requireGrowthRole') && route.includes('requireGrowthFeature')],
  ['uploads use server-side allowlisted TXT, CSV, Markdown, PDF, DOCX and XLSX extraction', route.includes('ALLOWED_EXTENSIONS') && route.includes('extractKnowledgeText')],
  ['upload size is capped at 10 MB', route.includes('10 * 1024 * 1024')],
  ['document storage is private and tenant-prefixed', route.includes("const BUCKET = 'growth-knowledge-private'") && route.includes('`${orgId}/${id}-${name}`')],
  ['document indexing chunks are bounded with overlap', route.includes('size = 1200, overlap = 150') && route.includes('out.length < 500')],
  ['index failure rolls back metadata and private object', route.includes('chunkError') && route.includes("storage.from(BUCKET).remove([path])")],
  ['delete removes object and tenant-scoped metadata', route.includes(".eq('id', documentId).eq('organization_id', orgId)") && route.includes('.remove([doc.storage_path])')],
  ['search endpoint enforces tenant and feature access', search.includes('requireGrowthRole') && search.includes('requireGrowthFeature')],
  ['search returns source citation metadata', search.includes('citation:') && search.includes('file_name')],
  ['database tables are tenant-scoped and RLS enabled', migration.includes('organization_id uuid not null') && migration.includes('enable row level security')],
  ['full text search index is provisioned', migration.includes('using gin(search_vector)')],
  ['storage bucket is private', migration.includes("values ('growth-knowledge-private', 'growth-knowledge-private', false")],
  ['browser UI supports upload, search and deletion', ui.includes('Upload document') && ui.includes('Search passages') && ui.includes('Ask Knowledge Hub') && ui.includes('Delete')],
  ['Knowledge Hub is wired into Growth Control Center', center.includes('GrowthKnowledgeDocuments')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`\n${checks.length - failed} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
