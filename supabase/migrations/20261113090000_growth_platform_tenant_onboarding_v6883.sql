-- Atomic platform tenant onboarding. Only service_role may execute; actor is revalidated.
create or replace function public.growth_platform_create_tenant(
  p_actor_user_id uuid,
  p_owner_user_id uuid,
  p_name text,
  p_slug text,
  p_plan text,
  p_website_url text default null,
  p_industry text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_org public.growth_organizations%rowtype;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_user_id) then
    raise exception 'Platform administrator access required' using errcode='42501';
  end if;
  if p_owner_user_id is null or not exists(select 1 from auth.users u where u.id=p_owner_user_id) then
    raise exception 'A valid existing owner account is required' using errcode='22023';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_slug,''))) < 3 then
    raise exception 'Workspace name and slug are required' using errcode='22023';
  end if;
  if p_plan not in ('agency-managed','starter','growth','agency','enterprise') then
    raise exception 'Invalid workspace plan' using errcode='22023';
  end if;
  insert into public.growth_organizations(name,slug,plan,status,website_url,industry)
  values(trim(p_name),lower(trim(p_slug)),p_plan,'active',nullif(trim(coalesce(p_website_url,'')),''),nullif(trim(coalesce(p_industry,'')),''))
  returning * into v_org;
  insert into public.growth_members(organization_id,user_id,role)
  values(v_org.id,p_owner_user_id,'owner');
  insert into public.growth_platform_audit_events(organization_id,actor_user_id,target_user_id,event_type,metadata)
  values(v_org.id,p_actor_user_id,p_owner_user_id,'platform.tenant_created',jsonb_build_object('plan',p_plan,'slug',v_org.slug));
  return jsonb_build_object('id',v_org.id,'name',v_org.name,'slug',v_org.slug,'plan',v_org.plan,'status',v_org.status,'owner_user_id',p_owner_user_id);
end;
$$;
revoke all on function public.growth_platform_create_tenant(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.growth_platform_create_tenant(uuid,uuid,text,text,text,text,text) to service_role;
