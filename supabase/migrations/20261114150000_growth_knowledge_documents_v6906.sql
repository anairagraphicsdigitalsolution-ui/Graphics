-- Tenant-isolated Knowledge Hub documents and searchable text chunks.
create table if not exists public.growth_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  storage_path text not null unique,
  extraction_status text not null default 'indexed' check (extraction_status in ('indexed','failed')),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists growth_knowledge_documents_org_created_idx
  on public.growth_knowledge_documents(organization_id, created_at desc);

create table if not exists public.growth_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  document_id uuid not null references public.growth_knowledge_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 6000),
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);
create index if not exists growth_knowledge_chunks_org_doc_idx
  on public.growth_knowledge_chunks(organization_id, document_id, chunk_index);
create index if not exists growth_knowledge_chunks_search_idx
  on public.growth_knowledge_chunks using gin(search_vector);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('growth-knowledge-private', 'growth-knowledge-private', false, 5242880,
  array['text/plain','text/csv','text/markdown']::text[])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.growth_knowledge_documents enable row level security;
alter table public.growth_knowledge_chunks enable row level security;
drop policy if exists growth_knowledge_documents_no_client_access on public.growth_knowledge_documents;
create policy growth_knowledge_documents_no_client_access on public.growth_knowledge_documents
  for all to anon, authenticated using (false) with check (false);
drop policy if exists growth_knowledge_chunks_no_client_access on public.growth_knowledge_chunks;
create policy growth_knowledge_chunks_no_client_access on public.growth_knowledge_chunks
  for all to anon, authenticated using (false) with check (false);
revoke all on public.growth_knowledge_documents, public.growth_knowledge_chunks from anon, authenticated;
grant all on public.growth_knowledge_documents, public.growth_knowledge_chunks to service_role;

-- The bucket is private and no browser-facing storage policy is created.
-- Service-role API routes are the only access path.
