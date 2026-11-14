-- Approved proposal delivery: consent-gated, idempotent and worker-confirmed.
alter table public.growth_proposals
  add column if not exists delivery_status text not null default 'not_requested'
    check (delivery_status in ('not_requested','queued','sent','failed')),
  add column if not exists delivery_job_id uuid references public.growth_jobs(id) on delete set null,
  add column if not exists delivered_at timestamptz,
  add column if not exists provider_message_id text;
create index if not exists growth_proposals_delivery_idx
  on public.growth_proposals(organization_id, delivery_status, updated_at desc);

create or replace function public.growth_queue_proposal_email(
  p_organization_id uuid, p_proposal_id uuid, p_actor_user_id uuid, p_subject text, p_body text
) returns table(job_id uuid, delivery_status text)
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_proposal public.growth_proposals%rowtype; v_lead public.growth_leads%rowtype; v_job_id uuid; v_role text;
begin
  select role into v_role from public.growth_members where organization_id=p_organization_id and user_id=p_actor_user_id;
  if coalesce(v_role,'') not in ('owner','manager') and not exists(select 1 from public.admin_users where user_id=p_actor_user_id) then
    raise exception 'Only workspace owners or managers can send proposals';
  end if;
  if not exists(select 1 from public.growth_organizations where id=p_organization_id and status='active') then raise exception 'Workspace is not active'; end if;
  select * into v_proposal from public.growth_proposals where id=p_proposal_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_proposal.status <> 'approved' then raise exception 'Only approved proposals can be sent'; end if;
  if v_proposal.delivery_status='sent' then raise exception 'Proposal has already been sent'; end if;
  if v_proposal.delivery_status='queued' then return query select v_proposal.delivery_job_id,v_proposal.delivery_status; return; end if;
  select * into v_lead from public.growth_leads where id=v_proposal.lead_id and organization_id=p_organization_id;
  if not found or v_lead.email is null or btrim(v_lead.email)='' or not coalesce(v_lead.consent_to_contact,false)
     or v_lead.contact_opted_out_at is not null or v_lead.email_bounced_at is not null or v_lead.email_complained_at is not null then
    raise exception 'Active email consent and a deliverable address are required';
  end if;
  insert into public.growth_jobs(organization_id,job_type,payload,status,run_at,attempts,max_attempts)
  values (p_organization_id,'send_email',jsonb_build_object('lead_id',v_lead.id,'proposal_id',v_proposal.id,
    'subject',left(coalesce(p_subject,'Business proposal'),180),'text',left(coalesce(p_body,''),10000)),'queued',now(),0,4)
  returning id into v_job_id;
  update public.growth_proposals set delivery_status='queued',delivery_job_id=v_job_id,updated_at=now()
    where id=p_proposal_id and organization_id=p_organization_id;
  return query select v_job_id,'queued'::text;
end; $$;
revoke all on function public.growth_queue_proposal_email(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.growth_queue_proposal_email(uuid,uuid,uuid,text,text) to service_role;
