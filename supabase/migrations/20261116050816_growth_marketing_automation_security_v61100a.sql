-- Keep atomic dead-letter resolution SECURITY INVOKER so tenant RLS remains authoritative.
drop function if exists public.resolve_growth_workflow_dead_letter(uuid,uuid,text);
create or replace function public.resolve_growth_workflow_dead_letter(
  p_organization_id uuid,p_dead_letter_id uuid,p_action text
) returns jsonb
language plpgsql
set search_path = pg_catalog, public, private, auth
as $$
declare v_item public.growth_workflow_dead_letters%rowtype; v_run public.growth_workflow_runs%rowtype; v_now timestamptz := now();
begin
  if auth.uid() is null or not private.is_growth_manager(p_organization_id) then raise exception 'Manager permission required.' using errcode='42501'; end if;
  if p_action not in ('retry','discard') then raise exception 'Unsupported dead-letter action.' using errcode='22023'; end if;
  select * into v_item from public.growth_workflow_dead_letters where id=p_dead_letter_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Dead-letter item not found.' using errcode='P0002'; end if;
  if v_item.status<>'open' then raise exception 'Only open dead-letter items can be resolved.' using errcode='40001'; end if;
  if p_action='retry' then
    select * into v_run from public.growth_workflow_runs where id=v_item.run_id and rule_id=v_item.rule_id and organization_id=p_organization_id for update;
    if not found or v_run.status not in ('failed','queued') then raise exception 'Workflow run is not eligible for retry.' using errcode='40001'; end if;
    update public.growth_workflow_runs set status='queued',attempts=0,locked_at=null,claim_token=null,next_run_at=v_now,last_error=null,completed_at=null,updated_at=v_now where id=v_run.id and organization_id=p_organization_id;
    update public.growth_workflow_dead_letters set status='retried',resolved_at=v_now,resolution='manual_retry',updated_at=v_now where id=v_item.id and organization_id=p_organization_id;
    insert into public.growth_workflow_run_events(organization_id,run_id,rule_id,event_type,details) values(p_organization_id,v_run.id,v_item.rule_id,'dlq_retried',jsonb_build_object('dead_letter_id',v_item.id,'actor',auth.uid()));
    return jsonb_build_object('ok',true,'status','queued');
  end if;
  update public.growth_workflow_dead_letters set status='discarded',resolved_at=v_now,resolution='manually_discarded',updated_at=v_now where id=v_item.id and organization_id=p_organization_id;
  insert into public.growth_workflow_run_events(organization_id,run_id,rule_id,event_type,details) values(p_organization_id,v_item.run_id,v_item.rule_id,'dlq_discarded',jsonb_build_object('dead_letter_id',v_item.id,'actor',auth.uid()));
  return jsonb_build_object('ok',true,'status','discarded');
end;
$$;
revoke all on function public.resolve_growth_workflow_dead_letter(uuid,uuid,text) from public,anon;
grant execute on function public.resolve_growth_workflow_dead_letter(uuid,uuid,text) to authenticated;
drop policy if exists growth_workflow_run_events_manager_insert on public.growth_workflow_run_events;
create policy growth_workflow_run_events_manager_insert on public.growth_workflow_run_events for insert to authenticated with check(private.is_growth_manager(organization_id));
grant insert on public.growth_workflow_run_events to authenticated;
