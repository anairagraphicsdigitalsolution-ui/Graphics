-- v6.113.0: atomically execute an approved Command Center action.
-- The API performs authenticated workspace/role/feature checks before calling this
-- service-role-only function. Task creation and action-ledger transition are one txn.
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
  v_marker text;
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
      'task_id', v_action.result->>'task_id');
  end if;

  if v_action.status <> 'approved' then
    return jsonb_build_object('success', false, 'status', 409, 'error', 'Only approved actions can execute.');
  end if;

  v_marker := 'command_action:' || p_action_id::text;

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
    select id into v_task_id
    from public.growth_tasks
    where organization_id = p_organization_id and workflow_step_key = v_marker;
  end if;

  if v_task_id is null then
    return jsonb_build_object('success', false, 'status', 503, 'error', 'Task creation could not be confirmed.');
  end if;

  update public.growth_command_actions
  set status = 'executed', executed_by = p_actor_id, executed_at = now(),
      result = jsonb_build_object('task_id', v_task_id, 'execution', 'internal_crm_task_created'),
      error_message = null, updated_at = now()
  where id = p_action_id and organization_id = p_organization_id;

  return jsonb_build_object('success', true, 'already_executed', false, 'task_id', v_task_id);
end;
$$;

revoke all on function public.execute_growth_command_action(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.execute_growth_command_action(uuid, uuid, uuid) to service_role;
