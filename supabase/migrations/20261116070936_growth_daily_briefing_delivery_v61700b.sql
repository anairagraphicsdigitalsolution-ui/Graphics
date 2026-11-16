-- v6.107.0b: allow the dedicated internal briefing job through the worker queue.
alter table public.growth_jobs
  drop constraint if exists growth_jobs_job_type_check;
alter table public.growth_jobs
  add constraint growth_jobs_job_type_check
  check (job_type in ('publish_content','send_whatsapp','send_email','send_whatsapp_template','send_sms','execute_rule','send_briefing_email'));
