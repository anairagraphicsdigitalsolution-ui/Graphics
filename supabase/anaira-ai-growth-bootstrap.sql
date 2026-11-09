-- Run once after applying the AI Growth Engine migration.
-- Replace the email with the email of your existing Anaira Supabase Auth admin.
-- This adds that Auth user to the existing portfolio admin allow-list.
insert into public.admin_users(user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
on conflict (user_id) do nothing;

-- Verify the Anaira admin account was added:
select u.email, a.user_id
from public.admin_users a
join auth.users u on u.id=a.user_id
where u.email='YOUR_ADMIN_EMAIL';
