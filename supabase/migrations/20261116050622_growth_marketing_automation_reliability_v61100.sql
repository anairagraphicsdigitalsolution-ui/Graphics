-- v6.101.0 Marketing Automation Engine reliability hardening.
alter table public.growth_workflow_runs
  add column if not exists max_attempts integer not null default 5,
  add column if not exists claim_token uuid;
alter table public.growth_workflow_runs
  drop constraint if exists growth_workflow_runs_max_attempts_check;
alter table public.growth_workflow_runs
  add constraint growth_workflow_runs_max_attempts_check check(max_attempts between 1 and 20);

-- Idempotency keys close the crash window between a workflow side effect and advancing its cursor.
alter table public.growth_tasks add column if not exists workflow_step_key text;
create unique index if not exists growth_tasks_workflow_step_key_uidx
  on public.growth_tasks(organization_id,workflow_step_key);
alter table public.growth_jobs add column if not exists idempotency_key text;
create unique index if not exists growth_jobs_idempotency_key_uidx
  on public.growth_jobs(organization_id,job_type,idempotency_key);

alter table public.growth_workflow_run_events
  drop constraint if exists growth_workflow_run_events_event_type_check;
alter table public.growth_workflow_run_events
  add constraint growth_workflow_run_events_event_type_check
  check(event_type in ('run_started','step_started','step_succeeded','step_waiting','step_skipped','step_failed','run_succeeded','run_failed','run_retried','run_cancelled','run_simulated','run_lease_recovered','run_lease_expired','dlq_retried','dlq_discarded'));

create or replace function public.claim_due_growth_workflow_runs(batch_limit integer default 10)
returns setof public.growth_workflow_runs
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_run public.growth_workflow_runs%rowtype; v_now timestamptz := now();
begin
  for v_run in
    select * from public.growth_workflow_runs
     where status='running' and locked_at is not null
       and locked_at < v_now - interval '10 minutes'
     order by locked_at for update skip locked
  loop
    if v_run.attempts >= v_run.max_attempts then
      update public.growth_workflow_runs
         set status='failed',locked_at=null,claim_token=null,
             completed_at=coalesce(completed_at,v_now),
             last_error=left('Workflow lease expired after maximum attempts. '||coalesce(last_error,''),2000),updated_at=v_now
       where id=v_run.id;
      insert into public.growth_workflow_dead_letters
        (organization_id,run_id,rule_id,lead_id,error_message,attempts,failed_at,status,updated_at)
      values(v_run.organization_id,v_run.id,v_run.rule_id,v_run.lead_id,
        'Workflow worker lease expired after maximum attempts.',v_run.attempts,v_now,'open',v_now)
      on conflict(run_id) do update set error_message=excluded.error_message,attempts=excluded.attempts,
        failed_at=excluded.failed_at,status='open',resolved_at=null,resolution=null,updated_at=v_now;
      insert into public.growth_workflow_run_events(organization_id,run_id,rule_id,event_type,details)
      values(v_run.organization_id,v_run.id,v_run.rule_id,'run_lease_expired',jsonb_build_object('attempts',v_run.attempts,'terminal',true));
    else
      update public.growth_workflow_runs
         set status='queued',locked_at=null,claim_token=null,
             next_run_at=v_now+make_interval(mins=>least(60,greatest(1,power(2,greatest(0,attempts-1))::integer))),
             last_error=coalesce(last_error,'Worker lease expired; run safely requeued.'),updated_at=v_now
       where id=v_run.id;
      insert into public.growth_workflow_run_events(organization_id,run_id,rule_id,event_type,details)
      values(v_run.organization_id,v_run.id,v_run.rule_id,'run_lease_recovered',
        jsonb_build_object('attempts',v_run.attempts,'retry_at',v_now+make_interval(mins=>least(60,greatest(1,power(2,greatest(0,v_run.attempts-1))::integer)))));
    end if;
  end loop;
  return query
  with due as (
    select id from public.growth_workflow_runs
     where status='queued' and next_run_at<=v_now and attempts<max_attempts
     order by next_run_at,created_at for update skip locked
     limit greatest(1,least(coalesce(batch_limit,10),50))
  )
  update public.growth_workflow_runs r
     set status='running',locked_at=v_now,claim_token=gen_random_uuid(),
         attempts=r.attempts+1,started_at=coalesce(r.started_at,v_now),updated_at=v_now
    from due where r.id=due.id returning r.*;
end;
$$;
revoke all on function public.claim_due_growth_workflow_runs(integer) from public,anon,authenticated;
grant execute on function public.claim_due_growth_workflow_runs(integer) to service_role;

create or replace function public.claim_due_growth_autonomous_schedules(batch_limit integer default 5)
returns setof public.growth_autonomous_schedules
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_schedule public.growth_autonomous_schedules%rowtype; v_now timestamptz := now();
begin
  for v_schedule in
    select * from public.growth_autonomous_schedules
     where enabled=true and locked_at is not null and locked_at < v_now - interval '20 minutes'
     order by locked_at for update skip locked
  loop
    if v_schedule.attempts >= v_schedule.max_attempts then
      update public.growth_autonomous_schedules
         set enabled=false,locked_at=null,last_error=left('Schedule worker lease expired after maximum attempts.',1500),updated_at=v_now
       where id=v_schedule.id;
      insert into public.growth_autonomous_schedule_runs
        (organization_id,schedule_id,schedule_type,status,error_message,started_at,completed_at)
      values(v_schedule.organization_id,v_schedule.id,v_schedule.schedule_type,'failed',
        'Schedule worker lease expired after maximum attempts.',v_schedule.locked_at,v_now);
    else
      update public.growth_autonomous_schedules
         set locked_at=null,next_run_at=v_now+make_interval(mins=>least(60,greatest(1,power(2,greatest(0,attempts-1))::integer))),
             last_error=coalesce(last_error,'Worker lease expired; schedule safely requeued.'),updated_at=v_now
       where id=v_schedule.id;
    end if;
  end loop;
  return query
  with due as (
    select s.id from public.growth_autonomous_schedules s
    join public.growth_organizations o on o.id=s.organization_id and o.status='active'
    where s.enabled=true and s.next_run_at<=v_now and s.locked_at is null
    order by s.next_run_at asc for update of s skip locked
    limit greatest(1,least(coalesce(batch_limit,5),20))
  )
  update public.growth_autonomous_schedules s set locked_at=v_now,attempts=s.attempts+1,updated_at=v_now
   from due where s.id=due.id returning s.*;
end;
$$;
revoke all on function public.claim_due_growth_autonomous_schedules(integer) from public,anon,authenticated;
grant execute on function public.claim_due_growth_autonomous_schedules(integer) to service_role;

create or replace function public.resolve_growth_workflow_dead_letter(
  p_organization_id uuid,p_dead_letter_id uuid,p_action text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, auth
as $$
declare v_item public.growth_workflow_dead_letters%rowtype; v_run public.growth_workflow_runs%rowtype; v_now timestamptz := now();
begin
  if auth.uid() is null or not private.is_growth_manager(p_organization_id) then
    raise exception 'Manager permission required.' using errcode='42501';
  end if;
  if p_action not in ('retry','discard') then raise exception 'Unsupported dead-letter action.' using errcode='22023'; end if;
  select * into v_item from public.growth_workflow_dead_letters
   where id=p_dead_letter_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Dead-letter item not found.' using errcode='P0002'; end if;
  if v_item.status<>'open' then raise exception 'Only open dead-letter items can be resolved.' using errcode='40001'; end if;
  if p_action='retry' then
    select * into v_run from public.growth_workflow_runs
     where id=v_item.run_id and rule_id=v_item.rule_id and organization_id=p_organization_id for update;
    if not found or v_run.status not in ('failed','queued') then raise exception 'Workflow run is not eligible for retry.' using errcode='40001'; end if;
    update public.growth_workflow_runs set status='queued',attempts=0,locked_at=null,claim_token=null,
      next_run_at=v_now,last_error=null,completed_at=null,updated_at=v_now
     where id=v_run.id and organization_id=p_organization_id;
    update public.growth_workflow_dead_letters set status='retried',resolved_at=v_now,resolution='manual_retry',updated_at=v_now
     where id=v_item.id and organization_id=p_organization_id;
    insert into public.growth_workflow_run_events(organization_id,run_id,rule_id,event_type,details)
    values(p_organization_id,v_run.id,v_item.rule_id,'dlq_retried',jsonb_build_object('dead_letter_id',v_item.id,'actor',auth.uid()));
    return jsonb_build_object('ok',true,'status','queued');
  end if;
  update public.growth_workflow_dead_letters set status='discarded',resolved_at=v_now,resolution='manually_discarded',updated_at=v_now
   where id=v_item.id and organization_id=p_organization_id;
  insert into public.growth_workflow_run_events(organization_id,run_id,rule_id,event_type,details)
  values(p_organization_id,v_item.run_id,v_item.rule_id,'dlq_discarded',jsonb_build_object('dead_letter_id',v_item.id,'actor',auth.uid()));
  return jsonb_build_object('ok',true,'status','discarded');
end;
$$;
revoke all on function public.resolve_growth_workflow_dead_letter(uuid,uuid,text) from public,anon;
grant execute on function public.resolve_growth_workflow_dead_letter(uuid,uuid,text) to authenticated;
