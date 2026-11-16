-- Module 5 AI Content Studio foundation. Additive schema changes only.
alter table public.growth_content
  add column if not exists caption text,
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists call_to_action text,
  add column if not exists language text not null default 'en',
  add column if not exists tone text not null default 'professional',
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb,
  add column if not exists brand_guidelines_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists published_external_id text,
  add column if not exists last_publish_error text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.growth_content drop constraint if exists growth_content_content_type_check;
alter table public.growth_content add constraint growth_content_content_type_check
  check (content_type = any (array['post','reel','story','carousel','article','ad_copy','blog','seo','product','festival']::text[]));

create index if not exists growth_content_org_calendar_v6950_idx on public.growth_content (organization_id, scheduled_at asc) where scheduled_at is not null;
create index if not exists growth_content_org_platform_status_v6950_idx on public.growth_content (organization_id, platform, status, created_at desc);

create table if not exists public.growth_content_templates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  name text not null, platform text, content_type text not null default 'post', language text not null default 'en', tone text not null default 'professional',
  prompt_template text not null, variables jsonb not null default '[]'::jsonb, is_default boolean not null default false, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint growth_content_templates_type_check check (content_type = any (array['post','reel','story','carousel','article','ad_copy','blog','seo','product','festival']::text[])),
  constraint growth_content_templates_name_check check (length(btrim(name)) between 1 and 100),
  constraint growth_content_templates_prompt_check check (length(btrim(prompt_template)) between 1 and 4000)
);
create index if not exists growth_content_templates_org_idx on public.growth_content_templates (organization_id, updated_at desc);
alter table public.growth_content_templates enable row level security;
drop policy if exists growth_content_templates_member_select on public.growth_content_templates;
create policy growth_content_templates_member_select on public.growth_content_templates for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_content_templates_manager_insert on public.growth_content_templates;
create policy growth_content_templates_manager_insert on public.growth_content_templates for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_content_templates_manager_update on public.growth_content_templates;
create policy growth_content_templates_manager_update on public.growth_content_templates for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin()) with check (private.is_growth_manager(organization_id) or public.is_anaira_admin());
drop policy if exists growth_content_templates_manager_delete on public.growth_content_templates;
create policy growth_content_templates_manager_delete on public.growth_content_templates for delete to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin());
grant select,insert,update,delete on public.growth_content_templates to authenticated;

create table if not exists public.growth_content_publication_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  content_id uuid not null references public.growth_content(id) on delete cascade,
  social_account_id uuid references public.growth_social_accounts(id) on delete set null,
  job_id uuid references public.growth_jobs(id) on delete set null,
  platform text not null, event_type text not null check (event_type in ('queued','attempt_started','published','failed','reconciled')),
  provider_post_id text, message text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists growth_content_publication_events_org_created_v6950_idx on public.growth_content_publication_events (organization_id, created_at desc);
create index if not exists growth_content_publication_events_content_v6950_idx on public.growth_content_publication_events (content_id, created_at desc);
alter table public.growth_content_publication_events enable row level security;
revoke all on public.growth_content_publication_events from anon, authenticated;
grant select,insert,update,delete on public.growth_content_publication_events to service_role;
