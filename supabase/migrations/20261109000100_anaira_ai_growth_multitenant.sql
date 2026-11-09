-- Anaira AI Growth Engine: multi-tenant marketing SaaS foundation
-- Portfolio CMS remains in site_settings/projects and is not tenant-scoped or modified.
create extension if not exists pgcrypto;

create table if not exists public.growth_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  industry text,
  plan text not null default 'agency-managed' check (plan in ('agency-managed','starter','growth','agency','enterprise')),
  status text not null default 'active' check (status in ('active','paused','suspended')),
  brand_profile jsonb not null default '{}'::jsonb,
  knowledge_base jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_members (
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('owner','manager','editor','viewer','client')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table if not exists public.growth_websites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  name text not null,
  domain text,
  website_url text not null,
  platform text not null default 'other',
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  website_id uuid references public.growth_websites(id) on delete set null,
  agent_type text not null check (agent_type in ('website_sales','lead_qualifier','content_assistant','seo_assistant','social_assistant')),
  name text not null,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  website_id uuid references public.growth_websites(id) on delete set null,
  agent_id uuid references public.growth_agents(id) on delete set null,
  visitor_id text,
  channel text not null default 'website',
  status text not null default 'open' check (status in ('open','qualified','handed_off','closed')),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  website_id uuid references public.growth_websites(id) on delete set null,
  conversation_id uuid references public.growth_conversations(id) on delete set null,
  name text not null,
  email text,
  phone text,
  source text not null default 'manual',
  requirement text,
  budget text,
  lead_temperature text not null default 'warm' check (lead_temperature in ('hot','warm','cold')),
  consent_to_contact boolean not null default false,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost')),
  created_at timestamptz not null default now()
);

create table if not exists public.growth_social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','linkedin','youtube','other')),
  account_name text not null,
  external_account_id text,
  connection_status text not null default 'not_connected' check (connection_status in ('not_connected','connected','expired','error')),
  credentials_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  social_account_id uuid references public.growth_social_accounts(id) on delete set null,
  title text not null default '',
  body text not null default '',
  media_urls jsonb not null default '[]'::jsonb,
  platform text,
  content_type text not null default 'post' check (content_type in ('post','reel','story','carousel','article')),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','scheduled','published','failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  name text not null,
  objective text,
  channel text not null default 'organic',
  status text not null default 'draft' check (status in ('draft','pending_approval','active','paused','completed')),
  budget numeric(12,2),
  starts_at timestamptz,
  ends_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  action_type text not null,
  enabled boolean not null default false,
  requires_approval boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_usage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  provider text not null,
  model text,
  operation text not null,
  input_units integer not null default 0,
  output_units integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists growth_members_user_idx on public.growth_members(user_id);
create index if not exists growth_websites_org_idx on public.growth_websites(organization_id);
create index if not exists growth_leads_org_created_idx on public.growth_leads(organization_id,created_at desc);
create index if not exists growth_content_org_status_idx on public.growth_content(organization_id,status);
create index if not exists growth_conversations_org_created_idx on public.growth_conversations(organization_id,created_at desc);

-- Private membership helpers bypass membership-table RLS only for this lookup.
-- They are not exposed through the Data API and always bind authorization to auth.uid().
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_growth_member(org_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth
as $$ select auth.uid() is not null and exists(select 1 from public.growth_members m where m.organization_id=org_id and m.user_id=auth.uid()); $$;
create or replace function private.is_growth_manager(org_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth
as $$ select auth.uid() is not null and exists(select 1 from public.growth_members m where m.organization_id=org_id and m.user_id=auth.uid() and m.role in ('owner','manager')); $$;
revoke all on function private.is_growth_member(uuid) from public, anon;
revoke all on function private.is_growth_manager(uuid) from public, anon;
grant execute on function private.is_growth_member(uuid),private.is_growth_manager(uuid) to authenticated;

alter table public.growth_organizations enable row level security;
alter table public.growth_members enable row level security;
alter table public.growth_websites enable row level security;
alter table public.growth_agents enable row level security;
alter table public.growth_conversations enable row level security;
alter table public.growth_leads enable row level security;
alter table public.growth_social_accounts enable row level security;
alter table public.growth_content enable row level security;
alter table public.growth_campaigns enable row level security;
alter table public.growth_automation_rules enable row level security;
alter table public.growth_usage_logs enable row level security;

drop policy if exists "growth org members read" on public.growth_organizations;
create policy "growth org members read" on public.growth_organizations for select to authenticated using (private.is_growth_member(id) or public.is_anaira_admin());
drop policy if exists "growth members read own org" on public.growth_members;
create policy "growth members read own org" on public.growth_members for select to authenticated using (user_id=(select auth.uid()) or private.is_growth_member(organization_id) or public.is_anaira_admin());

-- Only owners/managers can modify tenant configuration.
drop policy if exists "growth platform admins create orgs" on public.growth_organizations;
create policy "growth platform admins create orgs" on public.growth_organizations for insert to authenticated with check (public.is_anaira_admin());
drop policy if exists "growth platform admins create memberships" on public.growth_members;
create policy "growth platform admins create memberships" on public.growth_members for insert to authenticated with check (public.is_anaira_admin() or private.is_growth_manager(organization_id));
drop policy if exists "growth managers update org" on public.growth_organizations;
create policy "growth managers update org" on public.growth_organizations for update to authenticated using (private.is_growth_manager(id)) with check (private.is_growth_manager(id));

do $$ declare t text; begin
 foreach t in array array['growth_websites','growth_agents','growth_conversations','growth_leads','growth_social_accounts','growth_content','growth_campaigns','growth_automation_rules','growth_usage_logs'] loop
   execute format('drop policy if exists %I on public.%I', t||'_tenant_select', t);
   execute format('create policy %I on public.%I for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin())', t||'_tenant_select', t);
   execute format('drop policy if exists %I on public.%I', t||'_tenant_insert', t);
   execute format('create policy %I on public.%I for insert to authenticated with check (private.is_growth_manager(organization_id) or public.is_anaira_admin())', t||'_tenant_insert', t);
   execute format('drop policy if exists %I on public.%I', t||'_tenant_update', t);
   execute format('create policy %I on public.%I for update to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin()) with check (private.is_growth_manager(organization_id) or public.is_anaira_admin())', t||'_tenant_update', t);
   execute format('drop policy if exists %I on public.%I', t||'_tenant_delete', t);
   execute format('create policy %I on public.%I for delete to authenticated using (private.is_growth_manager(organization_id) or public.is_anaira_admin())', t||'_tenant_delete', t);
 end loop;
end $$;

grant select,update on public.growth_organizations to authenticated;
grant select on public.growth_members to authenticated;
grant select,insert,update,delete on public.growth_websites,public.growth_agents,public.growth_conversations,public.growth_leads,public.growth_social_accounts,public.growth_content,public.growth_campaigns,public.growth_automation_rules,public.growth_usage_logs to authenticated;

-- Important: tenant membership bootstrap/invitation is deliberately admin-controlled.
-- Do not let users self-insert membership rows or assign themselves owner privileges.
