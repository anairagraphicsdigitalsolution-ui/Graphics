-- Module 14: scanned document OCR metadata and retrieval quality evaluation history.
alter table public.growth_knowledge_documents
  add column if not exists extraction_method text not null default 'native'
    check (extraction_method in ('native','ocr')),
  add column if not exists ocr_model text;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'text/plain','text/csv','text/markdown','application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg','image/png','image/webp'
    ]::text[]
where id = 'growth-knowledge-private';

create table if not exists public.growth_knowledge_retrieval_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  metrics jsonb not null default '{}'::jsonb,
  test_cases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists growth_knowledge_retrieval_evaluations_org_created_idx
  on public.growth_knowledge_retrieval_evaluations(organization_id,created_at desc);
alter table public.growth_knowledge_retrieval_evaluations enable row level security;
drop policy if exists growth_knowledge_retrieval_evaluations_no_client_access on public.growth_knowledge_retrieval_evaluations;
create policy growth_knowledge_retrieval_evaluations_no_client_access
  on public.growth_knowledge_retrieval_evaluations for all to anon,authenticated
  using (false) with check (false);
revoke all on public.growth_knowledge_retrieval_evaluations from anon,authenticated;
grant all on public.growth_knowledge_retrieval_evaluations to service_role;
comment on table public.growth_knowledge_retrieval_evaluations is
  'Tenant-scoped retrieval evaluation runs with owner/manager-labelled expected document IDs; service-role API only.';
