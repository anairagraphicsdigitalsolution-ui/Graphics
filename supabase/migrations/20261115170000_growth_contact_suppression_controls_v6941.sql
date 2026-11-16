-- Manager-controlled per-contact channel suppression with atomic audit metadata.
create or replace function public.growth_set_lead_channel_suppression(
  p_organization_id uuid,
  p_lead_id uuid,
  p_actor_user_id uuid,
  p_channel text,
  p_suppressed boolean,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lead public.growth_leads%rowtype;
  v_suppressions jsonb;
  v_entry jsonb;
begin
  if p_channel not in ('email','whatsapp','sms','voice') then raise exception 'invalid_channel'; end if;
  if p_suppressed and length(trim(coalesce(p_reason,''))) < 3 then raise exception 'suppression_reason_required'; end if;
  if not exists (select 1 from public.growth_members m where m.organization_id=p_organization_id and m.user_id=p_actor_user_id and m.role in ('owner','manager')) then raise exception 'manager_required'; end if;
  select * into v_lead from public.growth_leads
    where id=p_lead_id and organization_id=p_organization_id for update;
  if not found then raise exception 'lead_not_found'; end if;
  v_suppressions := coalesce(v_lead.channel_suppressions,'{}'::jsonb);
  v_entry := jsonb_build_object(
    'suppressed',coalesce(p_suppressed,false),
    'reason',case when p_suppressed then left(trim(p_reason),500) else null end,
    'updated_at',now(),
    'updated_by',p_actor_user_id
  );
  update public.growth_leads
    set channel_suppressions=jsonb_set(v_suppressions,array[p_channel],v_entry,true), updated_at=now()
    where id=p_lead_id and organization_id=p_organization_id;
  return v_entry;
end;
$$;
revoke all on function public.growth_set_lead_channel_suppression(uuid,uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.growth_set_lead_channel_suppression(uuid,uuid,uuid,text,boolean,text) to service_role;
