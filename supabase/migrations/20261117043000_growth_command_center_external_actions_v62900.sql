-- v6.129.0: extend approval-gated Command Center execution to consent-checked
-- email and WhatsApp jobs. Provider delivery remains asynchronous in the worker.
alter table public.growth_command_actions
  drop constraint if exists growth_command_actions_action_type_check;

alter table public.growth_command_actions
  add constraint growth_command_actions_action_type_check
  check (action_type in ('create_task','send_email','send_whatsapp'));

alter table public.growth_command_actions
  add column if not exists action_payload jsonb not null default '{}'::jsonb;

create or replace function public.execute_growth_command_action(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_action public.growth_command_actions%rowtype;
  v_task_id uuid;
  v_job_id uuid;
  v_marker text;
  v_job_type text;
  v_payload jsonb;
begin
  select * into v_action
  from public.growth_command_actions
  where id = p_action_id and organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'status', 404, 'error', 'Action proposal not found in this workspace.');
  end if;

  if v_action.status = 'executed' then
    return jsonb_build_object('success', true, 'already_executed', true,
      'task_id', v_action.result->>'task_id', 'job_id', v_action.result->>'job_id',
      'execution', v_action.result->>'execution');
  end if;

  if v_action.status <> 'approved' then
    return jsonb_build_object('success', false, 'status', 409, 'error', 'Only approved actions can execute.');
  end if;

  v_marker := 'command_action:' || p_action_id::text;

  if v_action.action_type = 'create_task' then
    insert into public.growth_tasks (
      organization_id, lead_id, title, description, task_type, status,
      due_at, assigned_to, created_by, workflow_step_key
    ) values (
      p_organization_id, null, v_action.title,
      v_marker || E'\\n' || coalesce(nullif(v_action.description, ''), 'Approved from AI Command Center.'),
      'other', 'open', coalesce(v_action.due_at, now()), p_actor_id, p_actor_id, v_marker
    )
    on conflict (organization_id, workflow_step_key) do nothing
    returning id into v_task_id;

    if v_task_id is null then
      select id into v_task_id from public.growth_tasks
      where organization_id = p_organization_id and workflow_step_key = v_marker;
    end if;
    if v_task_id is null then
      return jsonb_build_object('success', false, 'status', 503, 'error', 'Task creation could not be confirmed.');
    end if;

    v_payload := jsonb_build_object('task_id', v_task_id, 'execution', 'internal_crm_task_created');
  elsif v_action.action_type in ('send_email','send_whatsapp') then
    v_job_type := v_action.action_type;
    if v_action.action_payload is null or v_action.action_payload = '{}'::jsonb
       or nullif(v_action.action_payload->>'lead_id','') is null then
      return jsonb_build_object('success', false, 'status', 409, 'error', 'External action payload is missing its lead reference.');
    end if;
    if v_job_type = 'send_email' and nullif(v_action.action_payload->>'text','') is null then
      return jsonb_build_object('success', false, 'status', 409, 'error', 'Email action body is missing.');
    end if;
    if v_job_type = 'send_whatsapp' and nullif(v_action.action_payload->>'message','') is null then
      return jsonb_build_object('success', false, 'status', 409, 'error', 'WhatsApp action message is missing.');
    end if;

    insert into public.growth_jobs (
      organization_id, job_type, payload, status, run_at, attempts, max_attempts, idempotency_key
    ) values (
      p_organization_id, v_job_type, v_action.action_payload, 'queued', now(), 0, 3, v_marker
    )
    on conflict (organization_id, job_type, idempotency_key) do nothing
    returning id into v_job_id;

    if v_job_id is null then
      select id into v_job_id from public.growth_jobs
      where organization_id = p_organization_id and job_type = v_job_type and idempotency_key = v_marker;
    end if;
    if v_job_id is null then
      return jsonb_build_object('success', false, 'status', 503, 'error', 'External communication job could not be confirmed.');
    end if;

    v_payload := jsonb_build_object('job_id', v_job_id, 'execution', 'external_communication_queued', 'job_type', v_job_type);
  else
    return jsonb_build_object('success', false, 'status', 400, 'error', 'Unsupported Command Center action type.');
  end if;

  update public.growth_command_actions
  set status = 'executed', executed_by = p_actor_id, executed_at = now(),
      result = v_payload, error_message = null, updated_at = now()
  where id = p_action_id and organization_id = p_organization_id;

  return jsonb_build_object('success', true, 'already_executed', false,
    'task_id', v_task_id, 'job_id', v_job_id, 'execution', v_payload->>'execution');
end;
$$;

revoke all on function public.execute_growth_command_action(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.execute_growth_command_action(uuid, uuid, uuid) to service_role;
