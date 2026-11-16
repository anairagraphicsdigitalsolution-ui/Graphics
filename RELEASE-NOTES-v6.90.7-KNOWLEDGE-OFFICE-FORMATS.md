# Release Notes — v6.90.7 Knowledge Hub Office Formats

## Implemented
- Knowledge Hub uploads now accept TXT, CSV, Markdown, PDF, DOCX and XLSX.
- Server-side extraction uses built-in Node.js facilities; no new runtime package dependency was added.
- DOCX extracts document body text and header/footer text.
- XLSX extracts shared strings, inline strings and worksheet cell values.
- PDF extracts selectable text from uncompressed and Flate-compressed content streams using common `Tj` and `TJ` text operators.
- Detected MIME types are stored instead of trusting the browser-supplied MIME type.
- Upload limit increased to 10 MB; Office ZIP entries, entry counts and aggregate expanded size are bounded.
- Added a migration to update the database file-size constraint and private Storage bucket allowlist.
- Scanned/image-only PDF OCR is explicitly not supported in this release.

## Verification
- Knowledge format static checks: 9/9.
- Extraction behavior fixtures: 4/4 (DOCX, XLSX, PDF, UTF-8 TXT).
- Full `npm run verify:all` and production build are not claimed here because this source archive does not include installed dependencies or a lockfile.

## Deployment
Apply `supabase/migrations/20261114160000_growth_knowledge_office_formats_v6907.sql` only after confirming the dedicated Growth Engine Supabase project and checking migration history. Do not apply to an unrelated Anaira CRM project.
