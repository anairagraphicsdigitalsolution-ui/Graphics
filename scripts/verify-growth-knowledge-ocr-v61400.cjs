'use strict';
const fs = require('node:fs');
const route = fs.readFileSync('app/api/growth/knowledge/documents/route.ts','utf8');
const ocr = fs.readFileSync('lib/growth-knowledge-ocr.ts','utf8');
const extractor = fs.readFileSync('lib/growth-knowledge-extract.js','utf8');
const ui = fs.readFileSync('components/growth-knowledge-documents.tsx','utf8');
const migration = fs.readFileSync('supabase/migrations/20261116060933_growth_knowledge_ocr_and_evaluation_v61400.sql','utf8');
const checks = [
 ['OCR uses workspace OpenAI integration',ocr.includes("getWorkspaceIntegration(db, input.organizationId, 'openai')")],
 ['OCR quota is consumed before provider call',ocr.indexOf('consumeGrowthQuota') < ocr.indexOf("fetch('https://api.openai.com/v1/responses'")],
 ['OCR uses Responses API with image/PDF input',ocr.includes("type: 'input_file'") && ocr.includes("type: 'input_image'")],
 ['OCR preserves original language and marks illegible text',ocr.includes('Keep the original language and script') && ocr.includes('[illegible]')],
 ['OCR has bounded output and timeout',ocr.includes('MAX_OCR_OUTPUT') && ocr.includes('AbortSignal.timeout(45_000)')],
 ['OCR usage is cost logged',ocr.includes("operation: 'knowledge_document_ocr'") && ocr.includes('estimateOpenAICost')],
 ['scanned PDFs fall back to OCR',route.includes('extension === \'pdf\'') && route.includes('extractKnowledgeOcr')],
 ['image-only documents are supported',route.includes("'jpg', 'jpeg', 'png', 'webp'")],
 ['OCR extraction metadata is persisted',route.includes('extraction_method: extractionMethod') && route.includes('ocr_model: ocrModel')],
 ['private bucket allows image OCR types',migration.includes("'image/jpeg','image/png','image/webp'") && migration.includes('public = false')],
 ['UI advertises OCR supported formats',ui.includes('.jpg,.jpeg,.png,.webp') && ui.includes('Scanned PDF and JPG/PNG/WEBP OCR')],
 ['native extraction remains supported',extractor.includes('function extractPdf') && extractor.includes('extractKnowledgeText')],
];
let failed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`\n${checks.length-failed} PASS / ${failed} FAIL`); if(failed)process.exit(1);
