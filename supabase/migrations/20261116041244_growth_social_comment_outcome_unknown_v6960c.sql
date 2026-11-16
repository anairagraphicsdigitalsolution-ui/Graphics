-- Preserve ambiguous provider outcomes; never automatically retry a possibly accepted public reply.
alter table public.growth_social_comments
  drop constraint if exists growth_social_comments_status_check;
alter table public.growth_social_comments
  add constraint growth_social_comments_status_check
  check (status in ('open','replying','replied','hidden','deleted','error','outcome_unknown'));
create index if not exists growth_social_comments_outcome_unknown_idx
  on public.growth_social_comments(organization_id, updated_at desc)
  where status='outcome_unknown';
