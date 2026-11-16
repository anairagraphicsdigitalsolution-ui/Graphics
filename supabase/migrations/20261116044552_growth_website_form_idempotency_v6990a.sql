alter table public.growth_website_form_submissions add column if not exists submission_id text;
update public.growth_website_form_submissions set submission_id=id::text where submission_id is null;
alter table public.growth_website_form_submissions alter column submission_id set not null;
create unique index if not exists growth_website_form_submission_idempotency_idx on public.growth_website_form_submissions(website_id,submission_id);
