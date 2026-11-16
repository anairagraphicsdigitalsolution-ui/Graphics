-- Expand Knowledge Hub uploads to PDF, DOCX and XLSX with bounded extraction.
alter table public.growth_knowledge_documents
  drop constraint if exists growth_knowledge_documents_file_size_check;
alter table public.growth_knowledge_documents
  add constraint growth_knowledge_documents_file_size_check
  check (file_size > 0 and file_size <= 10485760);

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'text/plain', 'text/csv', 'text/markdown', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
where id = 'growth-knowledge-private';
