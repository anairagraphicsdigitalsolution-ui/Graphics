-- v6.93.2: suppress blind retries when a worker may have called an external provider.
-- A provider timeout/crash can occur after acceptance but before local success is recorded.
alter table public.growth_jobs
  add column if not exists external_effect_started_at timestamptz;

create index if not exists growth_jobs_external_effect_started_idx
  on public.growth_jobs(external_effect_started_at)
  where external_effect_started_at is not null;

create or replace function public.claim_growth_jobs(batch_limit integer default 10)
returns setof public.growth_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- An abandoned provider dispatch has an ambiguous external outcome. Never retry it
  -- automatically: an operator must reconcile provider state before re-queueing.
  update public.growth_jobs
     set status = 'failed',
         locked_at = null,
         completed_at = coalesce(completed_at, now()),
         last_error = left(
           'OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED: worker expired after provider dispatch began; verify provider state before any manual retry. ' ||
           coalesce(last_error, ''),
           2000
         )
   where status = 'processing'
     and locked_at is not null
     and locked_at < now() - interval '10 minutes'
     and external_effect_started_at is not null;

  -- A stale claim that never entered provider dispatch is safe to retry.
  update public.growth_jobs
     set status = 'queued',
         run_at = now() + make_interval(mins => least(60, greatest(1, power(2, attempts)::integer))),
         locked_at = null,
         last_error = coalesce(last_error, 'Worker claim expired before provider dispatch; job recovered automatically.')
   where status = 'processing'
     and locked_at is not null
     and locked_at < now() - interval '10 minutes'
     and external_effect_started_at is null
     and attempts < max_attempts;

  update public.growth_jobs
     set status = 'failed',
         locked_at = null,
         completed_at = coalesce(completed_at, now()),
         last_error = coalesce(last_error, 'Worker claim expired after maximum attempts.')
   where status = 'processing'
     and locked_at is not null
     and locked_at < now() - interval '10 minutes'
     and external_effect_started_at is null
     and attempts >= max_attempts;

  return query
  with picked as (
    select id
      from public.growth_jobs
     where status = 'queued'
       and run_at <= now()
       and attempts < max_attempts
     order by run_at, created_at
     for update skip locked
     limit greatest(1, least(coalesce(batch_limit, 10), 50))
  )
  update public.growth_jobs j
     set status = 'processing',
         locked_at = now(),
         attempts = j.attempts + 1
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;

revoke all on function public.claim_growth_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_growth_jobs(integer) to service_role;
