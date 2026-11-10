-- Private, tenant-scoped CRM lead attachments. Access is mediated by authenticated API routes.
create table if not exists public.growth_lead_attachments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 lead_id uuid not null references public.growth_leads(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text not null,
 file_size bigint not null check(file_size > 0 and file_size <= 10485760),
 uploaded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists growth_lead_attachments_timeline_idx on public.growth_lead_attachments(organization_id,lead_id,created_at desc);
create index if not exists growth_lead_attachments_uploaded_by_idx on public.growth_lead_attachments(uploaded_by);
alter table public.growth_lead_attachments enable row level security;
revoke all on public.growth_lead_attachments from public, anon, authenticated;
grant all on public.growth_lead_attachments to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('growth-crm-private','growth-crm-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
