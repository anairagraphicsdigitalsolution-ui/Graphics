-- Recover queue jobs abandoned by a crashed/timed-out worker.
-- The claim function remains atomic and tenant-neutral; service_role only.
create index if not exists growth_jobs_processing_lock_idx
  on public.growth_jobs(locked_at)
  where status = 'processing';

create or replace function public.claim_growth_jobs(batch_limit integer default 10)
returns setof public.growth_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Requeue expired claims with bounded exponential backoff.
  update public.growth_jobs
     set status = 'queued',
         run_at = now() + make_interval(mins => least(60, greatest(1, power(2, attempts)::integer))),
         locked_at = null,
         last_error = coalesce(last_error, 'Worker claim expired; job recovered automatically.')
   where status = 'processing'
     and locked_at is not null
     and locked_at < now() - interval '10 minutes'
     and attempts < max_attempts;

  -- Exhausted jobs are terminal; they must not remain stuck in processing.
  update public.growth_jobs
     set status = 'failed',
         locked_at = null,
         completed_at = coalesce(completed_at, now()),
         last_error = coalesce(last_error, 'Worker claim expired after maximum attempts.')
   where status = 'processing'
     and locked_at is not null
     and locked_at < now() - interval '10 minutes'
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
