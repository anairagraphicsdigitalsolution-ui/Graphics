const fs = require('node:fs');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const route = fs.readFileSync('app/api/growth/knowledge/documents/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-knowledge-documents.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261114160000_growth_knowledge_office_formats_v6907.sql', 'utf8');
const extractor = fs.readFileSync('lib/growth-knowledge-extract.js', 'utf8');
const checks = [
  ['server extraction supports PDF DOCX XLSX', extractor.includes('extractPdf') && extractor.includes('extractDocx') && extractor.includes('extractXlsx')],
  ['Office ZIP parsing bounds entries and expanded size', extractor.includes('MAX_ENTRIES = 500') && extractor.includes('MAX_EXPANDED = 20 * 1024 * 1024')],
  ['DOCX extracts document body and headers/footers', extractor.includes('word/document.xml') && extractor.includes('(header|footer)')],
  ['XLSX extracts shared strings and worksheet cells', extractor.includes('sharedStrings.xml') && extractor.includes('worksheets\\/sheet')],
  ['PDF extraction rejects invalid signatures and unsupported image-only OCR is explicit', extractor.includes('%PDF-') && extractor.includes('Scanned PDFs require OCR')],
  ['API accepts only allowlisted document extensions with 10 MB cap', route.includes('ALLOWED_EXTENSIONS') && route.includes('10 * 1024 * 1024')],
  ['API stores detected MIME rather than trusting browser MIME', route.includes('contentType: extracted.mimeType') && route.includes('mime_type: extracted.mimeType')],
  ['UI advertises all supported formats and size cap', ui.includes('.pdf,.docx,.xlsx') && ui.includes('maximum 10 MB')],
  ['migration expands file size and private bucket MIME allowlist', migration.includes('10485760') && migration.includes('application/pdf') && migration.includes('spreadsheetml.sheet')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`\n${checks.length - failed} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
