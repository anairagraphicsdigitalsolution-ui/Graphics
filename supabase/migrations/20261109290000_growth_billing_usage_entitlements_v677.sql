-- Plan catalogue, tenant subscriptions and atomic quota metering.
-- Payment capture remains provider-neutral; this does not mark invoices paid.
create table if not exists public.growth_plans (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, description text not null default '',
 currency text not null default 'INR' check(currency in ('INR','USD')),
 monthly_price_minor bigint not null default 0 check(monthly_price_minor>=0),
 yearly_price_minor bigint not null default 0 check(yearly_price_minor>=0),
 limits jsonb not null default '{}'::jsonb, features jsonb not null default '{}'::jsonb,
 is_active boolean not null default true, sort_order integer not null default 100,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.growth_subscriptions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.growth_organizations(id) on delete cascade,
 plan_id uuid not null references public.growth_plans(id),
 status text not null default 'trialing' check(status in ('trialing','active','past_due','paused','cancelled','expired')),
 billing_interval text not null default 'month' check(billing_interval in ('month','year')),
 currency text not null default 'INR' check(currency in ('INR','USD')),
 amount_minor bigint not null default 0 check(amount_minor>=0),
 period_start timestamptz not null default date_trunc('month',now()),
 period_end timestamptz not null default (date_trunc('month',now())+interval '1 month'),
 trial_ends_at timestamptz, cancel_at_period_end boolean not null default false,
 cancelled_at timestamptz, payment_provider text, provider_customer_id text,
 provider_subscription_id text, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists growth_subscriptions_plan_status_idx on public.growth_subscriptions(plan_id,status);
create table if not exists public.growth_usage_counters (
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 metric text not null, period_start timestamptz not null,
 used bigint not null default 0 check(used>=0), updated_at timestamptz not null default now(),
 primary key(organization_id,metric,period_start)
);
create table if not exists public.growth_usage_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.growth_organizations(id) on delete cascade,
 metric text not null, quantity bigint not null check(quantity>0), period_start timestamptz not null,
 idempotency_key text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create unique index if not exists growth_usage_events_idempotency_idx on public.growth_usage_events(organization_id,metric,idempotency_key) where idempotency_key is not null;
create index if not exists growth_usage_events_org_created_idx on public.growth_usage_events(organization_id,created_at desc);
alter table public.growth_plans enable row level security;
alter table public.growth_subscriptions enable row level security;
alter table public.growth_usage_counters enable row level security;
alter table public.growth_usage_events enable row level security;
revoke all on public.growth_plans,public.growth_subscriptions,public.growth_usage_counters,public.growth_usage_events from public,anon,authenticated;
grant all on public.growth_plans,public.growth_subscriptions,public.growth_usage_counters,public.growth_usage_events to service_role;

create or replace function public.consume_growth_quota(
 p_organization_id uuid,p_metric text,p_quantity bigint default 1,
 p_idempotency_key text default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_status text; v_period_start timestamptz; v_limits jsonb:='{}'::jsonb;
 v_limit bigint:=-1; v_used bigint:=0; v_event_id uuid; v_plan_id uuid;
begin
 if p_quantity is null or p_quantity<1 or p_quantity>1000000000 then return jsonb_build_object('allowed',false,'reason','invalid_quantity'); end if;
 if p_metric not in ('leads','ai_messages','whatsapp_messages','email_messages','social_posts','media_bytes','workflow_runs') then return jsonb_build_object('allowed',false,'reason','unsupported_metric'); end if;
 select status into v_status from public.growth_organizations where id=p_organization_id;
 if v_status is distinct from 'active' then return jsonb_build_object('allowed',false,'reason','workspace_inactive'); end if;
 select s.plan_id,coalesce(s.period_start,date_trunc('month',now())),p.limits into v_plan_id,v_period_start,v_limits
 from public.growth_subscriptions s join public.growth_plans p on p.id=s.plan_id and p.is_active=true
 where s.organization_id=p_organization_id and s.status in ('active','trialing') and s.period_end>now() limit 1;
 if v_plan_id is null then
  v_period_start:=date_trunc('month',now());
  select limits into v_limits from public.growth_plans where slug=(select plan from public.growth_organizations where id=p_organization_id) and is_active=true limit 1;
 end if;
 v_limits:=coalesce(v_limits,'{}'::jsonb);
 begin v_limit:=coalesce((v_limits->>p_metric)::bigint,-1); exception when others then v_limit:=-1; end;
 insert into public.growth_usage_counters(organization_id,metric,period_start,used) values(p_organization_id,p_metric,v_period_start,0) on conflict do nothing;
 select used into v_used from public.growth_usage_counters where organization_id=p_organization_id and metric=p_metric and period_start=v_period_start for update;
 if p_idempotency_key is not null and exists(select 1 from public.growth_usage_events where organization_id=p_organization_id and metric=p_metric and idempotency_key=p_idempotency_key) then return jsonb_build_object('allowed',true,'duplicate',true,'metric',p_metric,'used',v_used,'limit',v_limit,'period_start',v_period_start); end if;
 if v_limit>=0 and v_used+p_quantity>v_limit then return jsonb_build_object('allowed',false,'reason','quota_exceeded','metric',p_metric,'used',v_used,'limit',v_limit,'period_start',v_period_start); end if;
 insert into public.growth_usage_events(organization_id,metric,quantity,period_start,idempotency_key,metadata)
 values(p_organization_id,p_metric,p_quantity,v_period_start,nullif(p_idempotency_key,''),coalesce(p_metadata,'{}'::jsonb))
 on conflict(organization_id,metric,idempotency_key) where idempotency_key is not null do nothing returning id into v_event_id;
 if p_idempotency_key is not null and v_event_id is null then return jsonb_build_object('allowed',true,'duplicate',true,'metric',p_metric,'used',v_used,'limit',v_limit,'period_start',v_period_start); end if;
 update public.growth_usage_counters set used=used+p_quantity,updated_at=now() where organization_id=p_organization_id and metric=p_metric and period_start=v_period_start returning used into v_used;
 return jsonb_build_object('allowed',true,'duplicate',false,'metric',p_metric,'used',v_used,'limit',v_limit,'period_start',v_period_start);
end; $$;
revoke all on function public.consume_growth_quota(uuid,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.consume_growth_quota(uuid,text,bigint,text,jsonb) to service_role;
