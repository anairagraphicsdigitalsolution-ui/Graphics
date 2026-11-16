-- Tenant-scoped semantic retrieval for Knowledge Hub.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

alter table public.growth_knowledge_documents
  add column if not exists embedding_status text not null default 'pending' check (embedding_status in ('pending','complete','failed'));

alter table public.growth_knowledge_chunks
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamptz;

create index if not exists growth_knowledge_chunks_embedding_hnsw_idx
  on public.growth_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create or replace function public.match_growth_knowledge_chunks(
  p_organization_id uuid,
  p_embedding extensions.vector(1536),
  p_match_count integer default 8,
  p_min_similarity double precision default 0.18
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity double precision,
  file_name text,
  mime_type text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select c.id, c.document_id, c.chunk_index, c.content,
         (1 - (c.embedding <=> p_embedding))::double precision as similarity,
         d.file_name, d.mime_type, d.created_at
  from public.growth_knowledge_chunks c
  join public.growth_knowledge_documents d
    on d.id = c.document_id and d.organization_id = c.organization_id
  where c.organization_id = p_organization_id
    and c.embedding is not null
    and (1 - (c.embedding <=> p_embedding)) >= greatest(0, least(1, p_min_similarity))
  order by c.embedding <=> p_embedding
  limit greatest(1, least(20, coalesce(p_match_count, 8)));
$$;

revoke all on function public.match_growth_knowledge_chunks(uuid, extensions.vector, integer, double precision) from public, anon, authenticated;
grant execute on function public.match_growth_knowledge_chunks(uuid, extensions.vector, integer, double precision) to service_role;

comment on function public.match_growth_knowledge_chunks(uuid, extensions.vector, integer, double precision)
  is 'Tenant-scoped cosine-similarity retrieval for Knowledge Hub; callable only by service_role.';

-- Align the original 5 MiB database/storage limit with the API's documented 10 MiB limit.
alter table public.growth_knowledge_documents
  drop constraint if exists growth_knowledge_documents_file_size_check;
alter table public.growth_knowledge_documents
  add constraint growth_knowledge_documents_file_size_check check (file_size > 0 and file_size <= 10485760);
update storage.buckets set file_size_limit = 10485760
where id = 'growth-knowledge-private';
