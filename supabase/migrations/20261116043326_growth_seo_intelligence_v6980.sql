-- Module 8 SEO Intelligence: tenant-scoped keyword targets, provider metrics and prioritized work.
create table if not exists public.growth_seo_keywords (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade,
 keyword text not null check (length(btrim(keyword)) between 1 and 200),
 country text not null default 'IND' check (length(country) between 2 and 3),
 device text not null default 'ALL' check (device in ('ALL','DESKTOP','MOBILE','TABLET')),
 target_url text,
 search_intent text not null default 'unknown' check (search_intent in ('unknown','informational','navigational','commercial','transactional')),
 priority text not null default 'medium' check (priority in ('low','medium','high')),
 status text not null default 'active' check (status in ('active','paused','archived')),
 latest_position numeric(8,2), previous_position numeric(8,2),
 clicks bigint not null default 0 check (clicks>=0), impressions bigint not null default 0 check (impressions>=0),
 ctr numeric(8,6) not null default 0 check (ctr>=0), last_verified_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,website_id,keyword,country,device)
);
create index if not exists growth_seo_keywords_org_site_status_idx on public.growth_seo_keywords(organization_id,website_id,status,priority);
alter table public.growth_seo_keywords enable row level security;
drop policy if exists growth_seo_keywords_tenant_select on public.growth_seo_keywords;
create policy growth_seo_keywords_tenant_select on public.growth_seo_keywords for select to authenticated using(private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_seo_keywords_tenant_insert on public.growth_seo_keywords;
create policy growth_seo_keywords_tenant_insert on public.growth_seo_keywords for insert to authenticated with check((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_seo_keywords.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager','editor'))) or public.is_anaira_admin());
drop policy if exists growth_seo_keywords_tenant_update on public.growth_seo_keywords;
create policy growth_seo_keywords_tenant_update on public.growth_seo_keywords for update to authenticated using((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_seo_keywords.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager','editor'))) or public.is_anaira_admin()) with check((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_seo_keywords.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager','editor'))) or public.is_anaira_admin());
grant select,insert,update on public.growth_seo_keywords to authenticated;
grant all on public.growth_seo_keywords to service_role;

create table if not exists public.growth_seo_search_metrics (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade, metric_date date not null,
 query text not null default '', page text not null default '', country text not null default '', device text not null default '',
 clicks bigint not null default 0, impressions bigint not null default 0, ctr numeric(10,8) not null default 0, position numeric(8,2), synced_at timestamptz not null default now(),
 unique(organization_id,website_id,metric_date,query,page,country,device)
);
create index if not exists growth_seo_search_metrics_org_date_idx on public.growth_seo_search_metrics(organization_id,website_id,metric_date desc);
create index if not exists growth_seo_search_metrics_query_idx on public.growth_seo_search_metrics(organization_id,website_id,query,metric_date desc);
alter table public.growth_seo_search_metrics enable row level security;
drop policy if exists growth_seo_search_metrics_tenant_select on public.growth_seo_search_metrics;
create policy growth_seo_search_metrics_tenant_select on public.growth_seo_search_metrics for select to authenticated using(private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_seo_search_metrics to authenticated;
grant all on public.growth_seo_search_metrics to service_role;

create table if not exists public.growth_seo_analytics_metrics (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade, metric_date date not null,
 landing_page text not null default '', source_medium text not null default '', sessions bigint not null default 0,
 engaged_sessions bigint not null default 0, total_users bigint not null default 0, conversions numeric(14,2) not null default 0,
 synced_at timestamptz not null default now(), unique(organization_id,website_id,metric_date,landing_page,source_medium)
);
create index if not exists growth_seo_analytics_org_date_idx on public.growth_seo_analytics_metrics(organization_id,website_id,metric_date desc);
alter table public.growth_seo_analytics_metrics enable row level security;
drop policy if exists growth_seo_analytics_tenant_select on public.growth_seo_analytics_metrics;
create policy growth_seo_analytics_tenant_select on public.growth_seo_analytics_metrics for select to authenticated using(private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_seo_analytics_metrics to authenticated;
grant all on public.growth_seo_analytics_metrics to service_role;

create table if not exists public.growth_seo_tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 website_id uuid not null references public.growth_websites(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200), description text not null default '',
 task_type text not null default 'optimization' check(task_type in ('technical','content','keyword','schema','performance','analytics','optimization')),
 priority text not null default 'medium' check(priority in ('low','medium','high','critical')),
 status text not null default 'open' check(status in ('open','in_progress','blocked','completed','dismissed')),
 source_data jsonb not null default '{}'::jsonb check(jsonb_typeof(source_data)='object'), due_at timestamptz,
 created_by uuid references auth.users(id) on delete set null, completed_by uuid references auth.users(id) on delete set null,
 completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists growth_seo_tasks_org_status_idx on public.growth_seo_tasks(organization_id,website_id,status,priority,created_at desc);
alter table public.growth_seo_tasks enable row level security;
drop policy if exists growth_seo_tasks_tenant_select on public.growth_seo_tasks;
create policy growth_seo_tasks_tenant_select on public.growth_seo_tasks for select to authenticated using(private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_seo_tasks_tenant_insert on public.growth_seo_tasks;
create policy growth_seo_tasks_tenant_insert on public.growth_seo_tasks for insert to authenticated with check((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_seo_tasks.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager','editor'))) or public.is_anaira_admin());
drop policy if exists growth_seo_tasks_tenant_update on public.growth_seo_tasks;
create policy growth_seo_tasks_tenant_update on public.growth_seo_tasks for update to authenticated using((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_seo_tasks.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager','editor'))) or public.is_anaira_admin()) with check((private.is_growth_member(organization_id) and exists(select 1 from public.growth_members m where m.organization_id=growth_seo_tasks.organization_id and m.user_id=auth.uid() and m.role in ('owner','manager','editor'))) or public.is_anaira_admin());
grant select,insert,update on public.growth_seo_tasks to authenticated;
grant all on public.growth_seo_tasks to service_role;
comment on table public.growth_seo_search_metrics is 'Real Google Search Console search analytics snapshots; average position is aggregated provider data, not a live SERP rank.';
comment on table public.growth_seo_analytics_metrics is 'Real Google Analytics 4 landing page/source metrics synced from an authorized property.';
