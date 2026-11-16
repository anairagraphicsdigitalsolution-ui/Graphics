-- Restrict post/comment table writes to server-side service-role operations.
revoke all on table public.growth_social_posts from anon, authenticated;
grant select on table public.growth_social_posts to authenticated;
grant all on table public.growth_social_posts to service_role;
revoke all on table public.growth_social_comments from anon, authenticated;
grant select on table public.growth_social_comments to authenticated;
grant all on table public.growth_social_comments to service_role;
