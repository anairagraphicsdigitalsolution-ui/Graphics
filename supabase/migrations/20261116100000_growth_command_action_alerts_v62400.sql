-- v6.119.0 / Function 11: workspace-scoped command-center alerts and escalation.
create table if not exists public.growth_command_action_alert_settings (
  organization_id uuid primary key references public.growth_organizations(id) on delete cascade,
  approval_overdue_hours integer not null default 24 check (approval_overdue_hours between 1 and 720),
  repeated_failure_threshold integer not null default 3 check (repeated_failure_threshold between 2 and 20),
  negative_feedback_threshold integer not null default 3 check (negative_feedback_threshold between 2 and 50),
  escalation_after_hours integer not null default 24 check (escalation_after_hours between 1 and 720),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_command_action_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  fingerprint text not null check (char_length(fingerprint) between 1 and 180),
  category text not null check (category in ('approval_overdue','repeated_execution_failures','negative_feedback')),
  severity text not null check (severity in ('high','critical')),
  title text not null check (char_length(title) between 1 and 180),
  description text not null check (char_length(description) between 1 and 1200),
  status text not null default 'active' check (status in ('active','acknowledged','escalated','resolved')),
  occurrences integer not null default 1 check (occurrences >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  escalated_by uuid,
  escalated_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fingerprint)
);
create index if not exists growth_command_action_alerts_org_status_idx
  on public.growth_command_action_alerts (organization_id, status, severity, last_seen_at desc);

alter table public.growth_command_action_alert_settings enable row level security;
alter table public.growth_command_action_alerts enable row level security;
revoke all on public.growth_command_action_alert_settings from anon, authenticated;
revoke all on public.growth_command_action_alerts from anon, authenticated;
grant all on public.growth_command_action_alert_settings to service_role;
grant all on public.growth_command_action_alerts to service_role;

create or replace function public.sync_growth_command_action_alerts(
  p_organization_id uuid,
  p_actor_id uuid,
  p_alerts jsonb
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_item jsonb; v_count integer := 0;
begin
  if jsonb_typeof(p_alerts) <> 'array' or jsonb_array_length(p_alerts) > 150 then
    return jsonb_build_object('success',false,'status',400,'error','Invalid alert batch.');
  end if;
  for v_item in select value from jsonb_array_elements(p_alerts) loop
    if coalesce(v_item->>'fingerprint','') = '' or coalesce(v_item->>'category','') not in ('approval_overdue','repeated_execution_failures','negative_feedback') then
      return jsonb_build_object('success',false,'status',400,'error','Invalid alert payload.');
    end if;
    insert into public.growth_command_action_alerts
      (organization_id,fingerprint,category,severity,title,description,status,occurrences,first_seen_at,last_seen_at)
    values (p_organization_id, left(v_item->>'fingerprint',180), v_item->>'category', v_item->>'severity',
      left(v_item->>'title',180), left(v_item->>'description',1200), 'active', 1, now(), now())
    on conflict (organization_id,fingerprint) do update set
      category=excluded.category, severity=excluded.severity, title=excluded.title, description=excluded.description,
      occurrences=case when public.growth_command_action_alerts.last_seen_at < now() - interval '5 minutes' then public.growth_command_action_alerts.occurrences + 1 else public.growth_command_action_alerts.occurrences end,
      last_seen_at=now(), updated_at=now(),
      status=case when public.growth_command_action_alerts.status='resolved' then 'active' else public.growth_command_action_alerts.status end,
      acknowledged_by=case when public.growth_command_action_alerts.status='resolved' then null else public.growth_command_action_alerts.acknowledged_by end,
      acknowledged_at=case when public.growth_command_action_alerts.status='resolved' then null else public.growth_command_action_alerts.acknowledged_at end,
      escalated_by=case when public.growth_command_action_alerts.status='resolved' then null else public.growth_command_action_alerts.escalated_by end,
      escalated_at=case when public.growth_command_action_alerts.status='resolved' then null else public.growth_command_action_alerts.escalated_at end;
    v_count := v_count + 1;
  end loop;
  insert into public.growth_platform_audit_events (organization_id,actor_user_id,event_type,metadata)
  values (p_organization_id,p_actor_id,'growth.command_alerts.scanned',jsonb_build_object('signals_detected',v_count));
  return jsonb_build_object('success',true,'signals_detected',v_count);
end; $$;

create or replace function public.transition_growth_command_action_alert(
  p_organization_id uuid,p_alert_id uuid,p_actor_id uuid,p_operation text
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_alert public.growth_command_action_alerts%rowtype; v_status text;
begin
  if p_operation not in ('acknowledge','escalate','resolve') then return jsonb_build_object('success',false,'status',400,'error','Unsupported alert operation.'); end if;
  select * into v_alert from public.growth_command_action_alerts where id=p_alert_id and organization_id=p_organization_id for update;
  if not found then return jsonb_build_object('success',false,'status',404,'error','Alert not found in this workspace.'); end if;
  if v_alert.status='resolved' then return jsonb_build_object('success',false,'status',409,'error','Resolved alerts cannot be changed.'); end if;
  if p_operation='acknowledge' then v_status:='acknowledged';
  elsif p_operation='escalate' then v_status:='escalated';
  else v_status:='resolved'; end if;
  update public.growth_command_action_alerts set status=v_status,
    acknowledged_by=case when p_operation='acknowledge' then p_actor_id else acknowledged_by end,
    acknowledged_at=case when p_operation='acknowledge' then now() else acknowledged_at end,
    escalated_by=case when p_operation='escalate' then p_actor_id else escalated_by end,
    escalated_at=case when p_operation='escalate' then now() else escalated_at end,
    resolved_by=case when p_operation='resolve' then p_actor_id else resolved_by end,
    resolved_at=case when p_operation='resolve' then now() else resolved_at end,
    updated_at=now() where id=p_alert_id and organization_id=p_organization_id;
  insert into public.growth_platform_audit_events (organization_id,actor_user_id,event_type,metadata)
  values (p_organization_id,p_actor_id,'growth.command_alert.'||p_operation,
    jsonb_build_object('alert_id',p_alert_id,'category',v_alert.category,'previous_status',v_alert.status,'next_status',v_status));
  return jsonb_build_object('success',true,'status',v_status);
end; $$;
revoke all on function public.sync_growth_command_action_alerts(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.transition_growth_command_action_alert(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sync_growth_command_action_alerts(uuid,uuid,jsonb) to service_role;
grant execute on function public.transition_growth_command_action_alert(uuid,uuid,uuid,text) to service_role;
