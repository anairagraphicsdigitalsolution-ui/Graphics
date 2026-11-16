-- v6.93.9: channel-specific contact consent. Generic consent is not channel authorization.
alter table public.growth_leads
  add column if not exists channel_consents jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'growth_leads_channel_consents_object_check'
      and conrelid = 'public.growth_leads'::regclass
  ) then
    alter table public.growth_leads
      add constraint growth_leads_channel_consents_object_check
      check (jsonb_typeof(channel_consents) = 'object');
  end if;
end $$;

create or replace function public.growth_set_lead_channel_consent(
  p_organization_id uuid,
  p_lead_id uuid,
  p_actor_user_id uuid,
  p_channel text,
  p_granted boolean,
  p_source text,
  p_method text default 'manual_confirmation'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_consent jsonb;
  v_entry jsonb;
begin
  if p_channel not in ('email','whatsapp','sms','voice') then
    raise exception 'invalid_channel';
  end if;
  if p_granted and (nullif(trim(coalesce(p_source,'')), '') is null
                    or nullif(trim(coalesce(p_method,'')), '') is null) then
    raise exception 'consent_evidence_required';
  end if;
  if p_actor_user_id is not null then
    select role into v_role
    from public.growth_members
    where organization_id = p_organization_id
      and user_id = p_actor_user_id;
    if coalesce(v_role,'') not in ('owner','manager') and not exists (
      select 1 from public.admin_users where user_id = p_actor_user_id
    ) then
      raise exception 'consent_manager_required';
    end if;
  elsif p_granted then
    raise exception 'actor_required_for_grant';
  end if;

  v_entry := jsonb_build_object(
    'granted', p_granted,
    'updated_at', now(),
    'source', left(coalesce(p_source, 'email_unsubscribe'), 240),
    'method', left(coalesce(p_method, 'one_click_unsubscribe'), 80),
    'updated_by', p_actor_user_id
  );

  update public.growth_leads
  set channel_consents = jsonb_set(
        coalesce(channel_consents, '{}'::jsonb),
        array[p_channel],
        v_entry,
        true
      ),
      updated_at = now()
  where id = p_lead_id and organization_id = p_organization_id
  returning channel_consents into v_consent;

  if not found then
    raise exception 'lead_not_found';
  end if;
  return v_consent -> p_channel;
end;
$$;

revoke all on function public.growth_set_lead_channel_consent(uuid,uuid,uuid,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.growth_set_lead_channel_consent(uuid,uuid,uuid,text,boolean,text,text) to service_role;

comment on column public.growth_leads.channel_consents is
  'Per-channel consent evidence. Generic consent_to_contact never authorizes a specific channel by itself.';
