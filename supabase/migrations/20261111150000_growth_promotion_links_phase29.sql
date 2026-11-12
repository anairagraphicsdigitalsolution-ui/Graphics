-- Tenant-scoped campaign links for website/product promotion and conversion attribution.
create table if not exists public.growth_promotion_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  destination_url text not null,
  campaign_source text,
  campaign_medium text,
  campaign_name text,
  click_count bigint not null default 0 check (click_count >= 0),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, name)
);
create index if not exists growth_promotion_links_org_created_idx on public.growth_promotion_links(organization_id,created_at desc);
create table if not exists public.growth_promotion_clicks (
  id bigint generated always as identity primary key,
  promotion_link_id uuid not null references public.growth_promotion_links(id) on delete cascade,
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer_host text,
  user_agent_family text
);
create index if not exists growth_promotion_clicks_org_time_idx on public.growth_promotion_clicks(organization_id,clicked_at desc);
alter table public.growth_promotion_links enable row level security;
alter table public.growth_promotion_clicks enable row level security;
drop policy if exists growth_promotion_links_member_select on public.growth_promotion_links;
create policy growth_promotion_links_member_select on public.growth_promotion_links for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
drop policy if exists growth_promotion_clicks_member_select on public.growth_promotion_clicks;
create policy growth_promotion_clicks_member_select on public.growth_promotion_clicks for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
grant select on public.growth_promotion_links, public.growth_promotion_clicks to authenticated;
grant all on public.growth_promotion_links, public.growth_promotion_clicks to service_role;
create or replace function public.record_growth_promotion_click(p_slug text,p_referrer_host text default null,p_user_agent_family text default null)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_link public.growth_promotion_links%rowtype;
begin
 select * into v_link from public.growth_promotion_links where slug=p_slug and enabled=true;
 if not found then return null; end if;
 insert into public.growth_promotion_clicks(promotion_link_id,organization_id,referrer_host,user_agent_family)
 values(v_link.id,v_link.organization_id,left(p_referrer_host,180),left(p_user_agent_family,80));
 update public.growth_promotion_links set click_count=click_count+1,updated_at=now() where id=v_link.id;
 return v_link.destination_url;
end; $$;
revoke all on function public.record_growth_promotion_click(text,text,text) from public,anon,authenticated;
grant execute on function public.record_growth_promotion_click(text,text,text) to service_role;
