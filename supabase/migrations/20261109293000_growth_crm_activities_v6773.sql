-- CRM activity timeline for tenant-scoped Customer 360 lead records.
create table if not exists public.growth_lead_activities (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 lead_id uuid not null references public.growth_leads(id) on delete cascade,
 activity_type text not null check(activity_type in ('note','call','email','meeting','whatsapp','status_change','system')),
 body text not null default '',
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists growth_lead_activities_timeline_idx on public.growth_lead_activities(organization_id,lead_id,created_at desc);
create index if not exists growth_lead_activities_lead_id_idx on public.growth_lead_activities(lead_id);
create index if not exists growth_lead_activities_created_by_idx on public.growth_lead_activities(created_by);
alter table public.growth_lead_activities enable row level security;
revoke all on public.growth_lead_activities from public,anon,authenticated;
grant all on public.growth_lead_activities to service_role;
