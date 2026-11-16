-- Manager-controlled resolution for outbound jobs whose provider outcome is ambiguous.
create table if not exists public.growth_external_effect_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.growth_organizations(id) on delete cascade,
  job_id uuid not null references public.growth_jobs(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('confirm_delivered','retry_after_provider_check','discard')),
  evidence text not null check (char_length(btrim(evidence)) between 12 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists growth_external_effect_reconciliations_org_created_idx
  on public.growth_external_effect_reconciliations(organization_id, created_at desc);
create index if not exists growth_external_effect_reconciliations_job_idx
  on public.growth_external_effect_reconciliations(job_id, created_at desc);
alter table public.growth_external_effect_reconciliations enable row level security;
revoke all on public.growth_external_effect_reconciliations from public, anon, authenticated;
grant select on public.growth_external_effect_reconciliations to authenticated;
grant all on public.growth_external_effect_reconciliations to service_role;
create policy growth_external_effect_reconciliations_manager_read
  on public.growth_external_effect_reconciliations for select to authenticated
  using (private.is_growth_manager(organization_id));

create or replace function public.resolve_growth_external_effect_job(
  p_organization_id uuid,
  p_job_id uuid,
  p_action text,
  p_evidence text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_job public.growth_jobs%rowtype;
  v_status text;
begin
  if v_actor is null or not private.is_growth_manager(p_organization_id) then
    raise exception 'MANAGER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;
  if p_action not in ('confirm_delivered','retry_after_provider_check','discard') then
    raise exception 'INVALID_RECONCILIATION_ACTION' using errcode = '22023';
  end if;
  if p_evidence is null or char_length(btrim(p_evidence)) < 12 or char_length(p_evidence) > 2000 then
    raise exception 'RECONCILIATION_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  select * into v_job
    from public.growth_jobs
   where id = p_job_id
     and organization_id = p_organization_id
   for update;
  if not found then
    raise exception 'JOB_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_job.status <> 'failed'
     or v_job.external_effect_started_at is null
     or coalesce(v_job.last_error,'') not like 'OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED:%' then
    raise exception 'JOB_NOT_PENDING_RECONCILIATION' using errcode = '55000';
  end if;

  insert into public.growth_external_effect_reconciliations
    (organization_id, job_id, actor_id, action, evidence)
  values (p_organization_id, p_job_id, v_actor, p_action, btrim(p_evidence));

  if p_action = 'confirm_delivered' then
    update public.growth_jobs
       set status = 'succeeded', completed_at = now(), locked_at = null,
           external_effect_started_at = null,
           last_error = 'Reconciled by workspace manager: provider delivery confirmed.'
     where id = p_job_id and organization_id = p_organization_id;
    v_status := 'succeeded';
  elsif p_action = 'retry_after_provider_check' then
    update public.growth_jobs
       set status = 'queued', run_at = now(), attempts = 0, locked_at = null,
           completed_at = null, external_effect_started_at = null, last_error = null
     where id = p_job_id and organization_id = p_organization_id;
    v_status := 'queued';
  else
    update public.growth_jobs
       set status = 'failed', completed_at = now(), locked_at = null,
           external_effect_started_at = null,
           last_error = 'Manually discarded after provider-state reconciliation.'
     where id = p_job_id and organization_id = p_organization_id;
    v_status := 'failed';
  end if;
  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'status', v_status, 'action', p_action);
end;
$$;
revoke all on function public.resolve_growth_external_effect_job(uuid,uuid,text,text) from public, anon;
grant execute on function public.resolve_growth_external_effect_job(uuid,uuid,text,text) to authenticated;
grant execute on function public.resolve_growth_external_effect_job(uuid,uuid,text,text) to service_role;
