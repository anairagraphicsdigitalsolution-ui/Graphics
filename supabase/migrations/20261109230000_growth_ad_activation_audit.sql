create table if not exists public.growth_ad_activation_audit (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 campaign_draft_id uuid not null references public.growth_ad_campaign_drafts(id) on delete cascade,
 action text not null check(action in ('activate','pause')),
 requested_daily_budget_minor bigint,
 calculated_daily_budget_minor bigint,
 status text not null check(status in ('pending','succeeded','failed','rolled_back')),
 requested_by uuid,
 provider_response jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists growth_ad_activation_audit_org_created_idx on public.growth_ad_activation_audit(organization_id,created_at desc);
alter table public.growth_ad_activation_audit enable row level security;
drop policy if exists growth_ad_activation_audit_select on public.growth_ad_activation_audit;
create policy growth_ad_activation_audit_select on public.growth_ad_activation_audit for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_ad_activation_audit to authenticated;
grant all on public.growth_ad_activation_audit to service_role;
