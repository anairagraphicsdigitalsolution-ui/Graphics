-- v6.92.4: Google Ads attribution and metered Anaira shared-provider usage.
create table if not exists public.growth_attribution_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  event_id text not null,
  lead_id uuid null references public.growth_leads(id) on delete set null,
  source text not null default 'unknown',
  campaign_id text,
  gclid text,
  gbraid text,
  wbraid text,
  event_name text not null default 'purchase',
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  currency char(3) not null default 'INR',
  occurred_at timestamptz not null default now(),
  consent_status text not null default 'unknown' check (consent_status in ('granted','denied','unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id,event_id)
);
create index if not exists growth_attribution_org_date_idx on public.growth_attribution_events(organization_id,occurred_at desc);
create index if not exists growth_attribution_org_campaign_idx on public.growth_attribution_events(organization_id,campaign_id);
alter table public.growth_attribution_events enable row level security;
drop policy if exists growth_attribution_member_read on public.growth_attribution_events;
create policy growth_attribution_member_read on public.growth_attribution_events for select to authenticated
using (exists(select 1 from public.growth_members m where m.organization_id=growth_attribution_events.organization_id and m.user_id=(select auth.uid())));
drop policy if exists growth_attribution_manager_write on public.growth_attribution_events;
create policy growth_attribution_manager_write on public.growth_attribution_events for all to authenticated
using (exists(select 1 from public.growth_members m where m.organization_id=growth_attribution_events.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')))
with check (exists(select 1 from public.growth_members m where m.organization_id=growth_attribution_events.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')));
grant select,insert,update,delete on public.growth_attribution_events to authenticated;
grant all on public.growth_attribution_events to service_role;

create table if not exists public.growth_platform_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  provider text not null,
  period_start date not null,
  used_units bigint not null default 0 check (used_units >= 0),
  updated_at timestamptz not null default now(),
  unique(organization_id,provider,period_start)
);
create index if not exists growth_platform_usage_period_idx on public.growth_platform_usage_monthly(period_start,provider);
alter table public.growth_platform_usage_monthly enable row level security;
drop policy if exists growth_platform_usage_manager_read on public.growth_platform_usage_monthly;
create policy growth_platform_usage_manager_read on public.growth_platform_usage_monthly for select to authenticated
using (exists(select 1 from public.growth_members m where m.organization_id=growth_platform_usage_monthly.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')));
grant select on public.growth_platform_usage_monthly to authenticated;
grant all on public.growth_platform_usage_monthly to service_role;

create table if not exists public.growth_platform_usage_plan_limits (
  id uuid primary key default gen_random_uuid(),
  plan_slug text not null,
  provider text not null,
  monthly_limit_units bigint not null check (monthly_limit_units > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(plan_slug,provider)
);
alter table public.growth_platform_usage_plan_limits enable row level security;
revoke all on public.growth_platform_usage_plan_limits from anon,authenticated;
grant all on public.growth_platform_usage_plan_limits to service_role;

create or replace function public.consume_growth_platform_usage(
  p_organization_id uuid, p_provider text, p_units bigint, p_monthly_limit bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_period date := date_trunc('month',now())::date; v_used bigint; v_plan text; v_plan_limit bigint; v_limit bigint;
begin
  if p_units is null or p_units < 1 then
    return jsonb_build_object('allowed',false,'reason','invalid_usage_units','used',0,'limit',0);
  end if;
  select plan into v_plan from public.growth_organizations where id=p_organization_id;
  select monthly_limit_units into v_plan_limit from public.growth_platform_usage_plan_limits where plan_slug=v_plan and provider=p_provider;
  if v_plan_limit is not null then
    v_limit := case when coalesce(p_monthly_limit,0)>0 then least(v_plan_limit,p_monthly_limit) else v_plan_limit end;
  else v_limit := coalesce(p_monthly_limit,0); end if;
  if v_limit < 1 then
    return jsonb_build_object('allowed',false,'reason','shared_usage_limit_not_configured','used',0,'limit',v_limit,'plan',v_plan);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_provider || ':' || v_period::text,0));
  insert into public.growth_platform_usage_monthly(organization_id,provider,period_start,used_units)
  values(p_organization_id,p_provider,v_period,0) on conflict(organization_id,provider,period_start) do nothing;
  select used_units into v_used from public.growth_platform_usage_monthly
  where organization_id=p_organization_id and provider=p_provider and period_start=v_period for update;
  if v_used + p_units > v_limit then
    return jsonb_build_object('allowed',false,'reason','shared_usage_monthly_cap_exceeded','used',v_used,'limit',v_limit,'plan',v_plan);
  end if;
  update public.growth_platform_usage_monthly set used_units=used_units+p_units,updated_at=now()
  where organization_id=p_organization_id and provider=p_provider and period_start=v_period;
  return jsonb_build_object('allowed',true,'used',v_used+p_units,'limit',v_limit,'period_start',v_period,'plan',v_plan);
end; $$;
revoke all on function public.consume_growth_platform_usage(uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.consume_growth_platform_usage(uuid,text,bigint,bigint) to service_role;


alter table public.growth_attribution_events
  add column if not exists conversion_action_id text,
  add column if not exists google_ads_upload_status text not null default 'not_requested' check (google_ads_upload_status in ('not_requested','pending','uploaded','failed','skipped_no_consent')),
  add column if not exists google_ads_upload_error text,
  add column if not exists google_ads_upload_response jsonb not null default '{}'::jsonb;

-- First-party lead attribution fields; ad-user-data consent is distinct from contact consent.
alter table public.growth_leads
  add column if not exists gclid text,
  add column if not exists gbraid text,
  add column if not exists wbraid text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists ad_user_data_consent boolean not null default false,
  add column if not exists won_revenue numeric(14,2) not null default 0 check (won_revenue >= 0),
  add column if not exists revenue_currency char(3) not null default 'INR';

-- Extend recurring schedules with Google Ads performance analysis / pre-approved pause policy.
alter table public.growth_autonomous_schedules drop constraint if exists growth_autonomous_schedules_schedule_type_check;
alter table public.growth_autonomous_schedules add constraint growth_autonomous_schedules_schedule_type_check
  check (schedule_type in ('prospect_discovery','campaign_analysis','google_ads_analysis'));
