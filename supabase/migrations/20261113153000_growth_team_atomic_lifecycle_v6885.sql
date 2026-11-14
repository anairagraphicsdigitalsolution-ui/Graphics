-- Atomic tenant team lifecycle. All SECURITY DEFINER entry points are service_role-only.
create or replace function public.growth_team_accept_invitation(
  p_invitation_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_invitation public.growth_team_invitations%rowtype;
  v_email text;
  v_org_status text;
begin
  select lower(email) into v_email from auth.users where id = p_user_id;
  if v_email is null then raise exception 'authenticated_email_unavailable'; end if;
  select * into v_invitation from public.growth_team_invitations
    where id = p_invitation_id for update;
  if not found or v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'invitation_invalid_or_expired';
  end if;
  if v_invitation.invited_user_id is distinct from p_user_id
     or lower(v_invitation.invited_email) <> v_email then
    raise exception 'invitation_identity_mismatch';
  end if;
  select status into v_org_status from public.growth_organizations
    where id = v_invitation.organization_id for update;
  if v_org_status is distinct from 'active' then raise exception 'workspace_inactive'; end if;
  insert into public.growth_members(organization_id,user_id,role)
    values(v_invitation.organization_id,p_user_id,v_invitation.invited_role)
    on conflict(organization_id,user_id) do nothing;
  update public.growth_team_invitations
    set status='accepted',accepted_at=now(),updated_at=now()
    where id=p_invitation_id;
  insert into public.growth_platform_audit_events(organization_id,actor_user_id,event_type,target_user_id,target_email,metadata)
    values(v_invitation.organization_id,p_user_id,'team.invitation_accepted',p_user_id,v_email,jsonb_build_object('role',v_invitation.invited_role));
  return jsonb_build_object('ok',true,'organizationId',v_invitation.organization_id,'role',v_invitation.invited_role);
end;
$$;

create or replace function public.growth_team_set_member_role(
  p_actor_user_id uuid, p_organization_id uuid, p_target_user_id uuid, p_role text
) returns jsonb
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor_role text; v_target_role text;
begin
  if p_role not in ('manager','editor','viewer','client') then raise exception 'invalid_role'; end if;
  perform 1 from public.growth_organizations where id=p_organization_id and status='active' for update;
  if not found then raise exception 'workspace_inactive_or_missing'; end if;
  select role into v_actor_role from public.growth_members where organization_id=p_organization_id and user_id=p_actor_user_id for update;
  if v_actor_role is distinct from 'owner' then raise exception 'owner_required'; end if;
  select role into v_target_role from public.growth_members where organization_id=p_organization_id and user_id=p_target_user_id for update;
  if not found or v_target_role='owner' then raise exception 'member_missing_or_owner'; end if;
  update public.growth_members set role=p_role where organization_id=p_organization_id and user_id=p_target_user_id;
  insert into public.growth_platform_audit_events(organization_id,actor_user_id,event_type,target_user_id,metadata)
    values(p_organization_id,p_actor_user_id,'team.member_role_changed',p_target_user_id,jsonb_build_object('from',v_target_role,'to',p_role));
  return jsonb_build_object('ok',true,'role',p_role);
end;
$$;

create or replace function public.growth_team_remove_member(
  p_actor_user_id uuid, p_organization_id uuid, p_target_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor_role text; v_target_role text;
begin
  if p_actor_user_id=p_target_user_id then raise exception 'cannot_remove_self'; end if;
  perform 1 from public.growth_organizations where id=p_organization_id and status='active' for update;
  if not found then raise exception 'workspace_inactive_or_missing'; end if;
  select role into v_actor_role from public.growth_members where organization_id=p_organization_id and user_id=p_actor_user_id for update;
  if v_actor_role is distinct from 'owner' then raise exception 'owner_required'; end if;
  select role into v_target_role from public.growth_members where organization_id=p_organization_id and user_id=p_target_user_id for update;
  if not found or v_target_role='owner' then raise exception 'member_missing_or_owner'; end if;
  delete from public.growth_members where organization_id=p_organization_id and user_id=p_target_user_id;
  insert into public.growth_platform_audit_events(organization_id,actor_user_id,event_type,target_user_id,metadata)
    values(p_organization_id,p_actor_user_id,'team.member_removed',p_target_user_id,jsonb_build_object('previous_role',v_target_role));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.growth_team_transfer_owner(
  p_actor_user_id uuid, p_organization_id uuid, p_target_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor_role text; v_target_role text;
begin
  if p_actor_user_id=p_target_user_id then raise exception 'cannot_transfer_to_self'; end if;
  perform 1 from public.growth_organizations where id=p_organization_id and status='active' for update;
  if not found then raise exception 'workspace_inactive_or_missing'; end if;
  select role into v_actor_role from public.growth_members where organization_id=p_organization_id and user_id=p_actor_user_id for update;
  if v_actor_role is distinct from 'owner' then raise exception 'owner_required'; end if;
  select role into v_target_role from public.growth_members where organization_id=p_organization_id and user_id=p_target_user_id for update;
  if not found or v_target_role='owner' then raise exception 'target_member_missing_or_already_owner'; end if;
  update public.growth_members set role='manager' where organization_id=p_organization_id and user_id=p_actor_user_id;
  update public.growth_members set role='owner' where organization_id=p_organization_id and user_id=p_target_user_id;
  insert into public.growth_platform_audit_events(organization_id,actor_user_id,event_type,target_user_id,metadata)
    values(p_organization_id,p_actor_user_id,'team.owner_transferred',p_target_user_id,jsonb_build_object('previous_owner',p_actor_user_id,'new_owner',p_target_user_id));
  return jsonb_build_object('ok',true,'newOwnerUserId',p_target_user_id);
end;
$$;

revoke all on function public.growth_team_accept_invitation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.growth_team_set_member_role(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.growth_team_remove_member(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.growth_team_transfer_owner(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.growth_team_accept_invitation(uuid,uuid) to service_role;
grant execute on function public.growth_team_set_member_role(uuid,uuid,uuid,text) to service_role;
grant execute on function public.growth_team_remove_member(uuid,uuid,uuid) to service_role;
grant execute on function public.growth_team_transfer_owner(uuid,uuid,uuid) to service_role;
