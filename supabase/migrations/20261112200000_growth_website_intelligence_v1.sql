-- Website Growth Intelligence v1: persisted SEO and health audit history.
create table if not exists public.growth_website_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  website_id uuid not null references public.growth_websites(id) on delete cascade,
  audit_type text not null default 'seo' check (audit_type in ('seo','health')),
  score integer not null check (score between 0 and 100),
  report jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists growth_website_audits_org_site_created_idx
  on public.growth_website_audits(organization_id,website_id,created_at desc);
alter table public.growth_website_audits enable row level security;
drop policy if exists growth_website_audits_no_client_access on public.growth_website_audits;
create policy growth_website_audits_no_client_access on public.growth_website_audits
  for all to anon, authenticated using (false) with check (false);
comment on table public.growth_website_audits is 'Workspace-scoped website SEO and health scan history. Accessed through authenticated server routes.';
