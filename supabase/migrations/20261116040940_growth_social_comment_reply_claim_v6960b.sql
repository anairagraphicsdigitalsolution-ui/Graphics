-- Prevent concurrent duplicate public replies to the same social comment.
alter table public.growth_social_comments
  add column if not exists reply_claimed_at timestamptz,
  add column if not exists reply_claimed_by uuid references auth.users(id) on delete set null;
alter table public.growth_social_comments
  drop constraint if exists growth_social_comments_status_check;
alter table public.growth_social_comments
  add constraint growth_social_comments_status_check
  check (status in ('open','replying','replied','hidden','deleted','error'));
create index if not exists growth_social_comments_reply_claim_idx
  on public.growth_social_comments(status, reply_claimed_at)
  where status='replying';
