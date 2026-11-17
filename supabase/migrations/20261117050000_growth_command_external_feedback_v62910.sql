-- v6.129.1: allow governed human feedback on external communication outcomes.
-- Exactly one linked artifact (CRM task or provider job) must be present.
alter table public.growth_command_action_feedback
  alter column task_id drop not null;

alter table public.growth_command_action_feedback
  add column if not exists job_id uuid references public.growth_jobs(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.growth_command_action_feedback'::regclass
      and conname = 'growth_command_action_feedback_one_artifact_check'
  ) then
    alter table public.growth_command_action_feedback
      add constraint growth_command_action_feedback_one_artifact_check
      check ((task_id is not null) <> (job_id is not null));
  end if;
end $$;

create index if not exists growth_command_action_feedback_org_job_created_idx
  on public.growth_command_action_feedback (organization_id, job_id, created_at desc)
  where job_id is not null;
