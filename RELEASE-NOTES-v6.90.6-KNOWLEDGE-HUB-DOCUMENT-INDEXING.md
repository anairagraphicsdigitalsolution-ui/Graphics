# Anaira AI Growth Engine v6.90.6 — Knowledge Hub document indexing

## Implemented in source
- Added tenant-scoped document metadata and chunk tables with RLS and service-role-only database grants.
- Added a private Supabase Storage bucket for Knowledge Hub source documents.
- Added authenticated, role- and plan-gated document upload/list/delete APIs.
- Added UTF-8 text extraction for TXT, CSV and Markdown up to 5 MB.
- Added bounded overlapping text chunking (1,200 characters, 150-character overlap; maximum 500 chunks per document).
- Added PostgreSQL full-text search and source-labelled passage results.
- Added Knowledge Hub upload/search/document management UI in the AI Growth Control Center.
- Upload indexing failures roll back the stored object and metadata; document deletion removes the private object and cascades indexed chunks.

## Explicit limitations
- PDF, DOCX and XLSX extraction are not enabled yet. Do not upload these formats to the Knowledge Hub document uploader.
- Search is PostgreSQL full-text search, not semantic/vector retrieval. It returns source-labelled passages; an LLM answer synthesis/citation evaluator is not part of this change.
- The migration is included but has not been applied to any remote Supabase project. Apply only after the dedicated Growth Engine project is confirmed.
- Live Supabase, clean production build and deployed end-to-end verification remain external release gates.
