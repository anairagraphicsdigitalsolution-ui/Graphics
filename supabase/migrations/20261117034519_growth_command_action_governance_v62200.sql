-- v6.117.0: enforce independent human review and auditable decision rationale.
alter table public.growth_command_actions
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approval_note text,
  add column if not exists rejection_reason text;

alter table public.growth_command_actions
  add constraint growth_command_actions_review_note_length
    check (approval_note is null or char_length(approval_note) <= 1200),
  add constraint growth_command_actions_rejection_reason_length
    check (rejection_reason is null or char_length(rejection_reason) between 1 and 1200);

create or replace function public.review_growth_command_action(
  p_organization_id uuid,
  p_action_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_action public.growth_command_actions%rowtype;
  v_next text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('approve', 'reject') then
    return jsonb_build_object('success', false, 'status', 400, 'error', 'Unsupported review decision.');
  end if;
  if p_decision = 'reject' and (v_note is null or char_length(v_note) > 1200) then
    return jsonb_build_object('success', false, 'status', 400, 'error', 'A rejection reason of 1–1200 characters is required.');
  end if;
  if p_decision = 'approve' and v_note is not null and char_length(v_note) > 1200 then
    return jsonb_build_object('success', false, 'status', 400, 'error', 'Approval note must be 1200 characters or fewer.');
  end if;

  select * into v_action
  from public.growth_command_actions
  where id = p_action_id and organization_id = p_organization_id
  for update;
  if not found then
    return jsonb_build_object('success', false, 'status', 404, 'error', 'Action proposal not found in this workspace.');
  end if;
  if v_action.status <> 'pending_approval' then
    return jsonb_build_object('success', false, 'status', 409, 'error', 'Only pending proposals can be reviewed.');
  end if;
  if v_action.created_by = p_actor_id then
    return jsonb_build_object('success', false, 'status', 403, 'error', 'The proposer cannot review their own action. A different workspace owner or manager must review it.');
  end if;

  v_next := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  update public.growth_command_actions
  set status = v_next,
      approved_by = case when p_decision = 'approve' then p_actor_id else approved_by end,
      approved_at = case when p_decision = 'approve' then now() else approved_at end,
      rejected_by = case when p_decision = 'reject' then p_actor_id else rejected_by end,
      rejected_at = case when p_decision = 'reject' then now() else rejected_at end,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      approval_note = case when p_decision = 'approve' then v_note else null end,
      rejection_reason = case when p_decision = 'reject' then v_note else null end,
      updated_at = now()
  where id = p_action_id and organization_id = p_organization_id;

  insert into public.growth_platform_audit_events
    (organization_id, actor_user_id, event_type, metadata)
  values
    (p_organization_id, p_actor_id, 'growth.command_action.' || v_next,
     jsonb_build_object('action_id', p_action_id, 'reviewed_by', p_actor_id,
       'decision', p_decision, 'rationale', v_note, 'independent_review', true));

  return jsonb_build_object('success', true, 'status', 200, 'decision', v_next,
    'reviewed_by', p_actor_id, 'reviewed_at', now());
end;
$$;

revoke all on function public.review_growth_command_action(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_growth_command_action(uuid, uuid, uuid, text, text) to service_role;
