-- Module 6: Social Media Management foundations.
-- Provider credentials remain encrypted in growth_social_accounts; no token is exposed to clients.
alter table public.growth_social_accounts
  add column if not exists token_health text not null default 'unknown',
  add column if not exists last_health_check_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists provider_profile_url text;

alter table public.growth_social_accounts
  drop constraint if exists growth_social_accounts_token_health_check;
alter table public.growth_social_accounts
  add constraint growth_social_accounts_token_health_check
  check (token_health in ('unknown','healthy','expiring','expired','error'));

create index if not exists growth_social_accounts_org_platform_health_idx
  on public.growth_social_accounts(organization_id, platform, connection_status, token_health);

create table if not exists public.growth_social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  social_account_id uuid not null references public.growth_social_accounts(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','linkedin','youtube')),
  provider_post_id text not null,
  permalink text,
  message text not null default '',
  published_at timestamptz,
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics)='object'),
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata)='object'),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(social_account_id, provider_post_id)
);
create index if not exists growth_social_posts_org_published_idx
  on public.growth_social_posts(organization_id, published_at desc);
create index if not exists growth_social_posts_account_published_idx
  on public.growth_social_posts(social_account_id, published_at desc);
alter table public.growth_social_posts enable row level security;
drop policy if exists growth_social_posts_tenant_select on public.growth_social_posts;
create policy growth_social_posts_tenant_select on public.growth_social_posts
  for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
revoke all on table public.growth_social_posts from anon, authenticated;
grant select on table public.growth_social_posts to authenticated;
grant all on table public.growth_social_posts to service_role;

create table if not exists public.growth_social_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  social_account_id uuid not null references public.growth_social_accounts(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram')),
  provider_comment_id text not null,
  provider_post_id text not null,
  parent_comment_id text,
  author_external_id text,
  author_name text not null default 'Social user',
  message text not null default '',
  like_count integer not null default 0 check (like_count >= 0),
  permalink text,
  provider_created_at timestamptz,
  status text not null default 'open' check (status in ('open','replied','hidden','deleted','error')),
  reply_text text,
  provider_reply_id text,
  replied_at timestamptz,
  last_error text,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata)='object'),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(social_account_id, provider_comment_id)
);
create index if not exists growth_social_comments_org_status_idx
  on public.growth_social_comments(organization_id, status, provider_created_at desc);
create index if not exists growth_social_comments_post_idx
  on public.growth_social_comments(social_account_id, provider_post_id, provider_created_at desc);
alter table public.growth_social_comments enable row level security;
drop policy if exists growth_social_comments_tenant_select on public.growth_social_comments;
create policy growth_social_comments_tenant_select on public.growth_social_comments
  for select to authenticated using (private.is_growth_member(organization_id) or public.is_anaira_admin());
revoke all on table public.growth_social_comments from anon, authenticated;
grant select on table public.growth_social_comments to authenticated;
grant all on table public.growth_social_comments to service_role;
