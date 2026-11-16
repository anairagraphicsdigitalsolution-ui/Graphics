-- Keep the analytics snapshot table read-only for workspace members;
-- service-role workers/API routes own all snapshot writes.
revoke all on table public.growth_social_insights from public, anon, authenticated;
grant select on table public.growth_social_insights to authenticated;
grant all on table public.growth_social_insights to service_role;
alter table public.growth_social_insights enable row level security;
