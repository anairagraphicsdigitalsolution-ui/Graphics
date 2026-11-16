-- Module 6: persist tenant-scoped LinkedIn organization analytics snapshots.
alter table public.growth_social_insights
  drop constraint if exists growth_social_insights_platform_check;
alter table public.growth_social_insights
  add constraint growth_social_insights_platform_check
  check (platform in ('facebook','instagram','linkedin'));

create index if not exists growth_social_insights_org_platform_period_idx
  on public.growth_social_insights(organization_id, platform, period_end desc);

alter table public.growth_social_insights enable row level security;
revoke insert, update, delete on public.growth_social_insights from anon, authenticated;
grant select on public.growth_social_insights to authenticated;
grant all on public.growth_social_insights to service_role;
