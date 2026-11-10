alter table public.growth_jobs drop constraint if exists growth_jobs_job_type_check;
alter table public.growth_jobs add constraint growth_jobs_job_type_check
 check (job_type = any (array['publish_content','send_whatsapp','send_email','send_whatsapp_template','execute_rule']::text[]));
