-- Store only one-way hashes for customer response URLs. Tokens are bearer secrets
-- generated in the server and never stored in plain text.
alter table public.growth_proposals
  add column if not exists response_token_hash text,
  add column if not exists response_token_expires_at timestamptz,
  add column if not exists response_token_issued_at timestamptz;
create unique index if not exists growth_proposals_response_token_unique_idx
  on public.growth_proposals(response_token_hash) where response_token_hash is not null;
create index if not exists growth_proposals_response_expiry_idx
  on public.growth_proposals(response_token_expires_at)
  where response_token_hash is not null;

create or replace function public.growth_queue_proposal_email_with_response(
  p_organization_id uuid,
  p_proposal_id uuid,
  p_actor_user_id uuid,
  p_subject text,
  p_body text,
  p_response_token_hash text,
  p_response_token_expires_at timestamptz
) returns table(job_id uuid, delivery_status text)
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
  v_proposal public.growth_proposals%rowtype;
  v_lead public.growth_leads%rowtype;
  v_job_id uuid;
  v_role text;
begin
  if p_response_token_hash !~ '^[a-f0-9]{64}$' or p_response_token_expires_at <= now() then
    raise exception 'A valid, unexpired response token is required';
  end if;
  select role into v_role from public.growth_members
   where organization_id=p_organization_id and user_id=p_actor_user_id;
  if coalesce(v_role,'') not in ('owner','manager')
     and not exists(select 1 from public.admin_users where user_id=p_actor_user_id) then
    raise exception 'Only workspace owners or managers can send proposals';
  end if;
  if not exists(select 1 from public.growth_organizations where id=p_organization_id and status='active') then
    raise exception 'Workspace is not active';
  end if;
  select * into v_proposal from public.growth_proposals
   where id=p_proposal_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_proposal.status <> 'approved' then raise exception 'Only approved proposals can be sent'; end if;
  if v_proposal.delivery_status='sent' then raise exception 'Proposal has already been sent'; end if;
  if v_proposal.delivery_status='queued' then
    return query select v_proposal.delivery_job_id,v_proposal.delivery_status;
    return;
  end if;
  select * into v_lead from public.growth_leads
   where id=v_proposal.lead_id and organization_id=p_organization_id;
  if not found or v_lead.email is null or btrim(v_lead.email)=''
     or not coalesce(v_lead.consent_to_contact,false)
     or v_lead.contact_opted_out_at is not null
     or v_lead.email_bounced_at is not null
     or v_lead.email_complained_at is not null then
    raise exception 'Active email consent and a deliverable address are required';
  end if;
  insert into public.growth_jobs(organization_id,job_type,payload,status,run_at,attempts,max_attempts)
  values(p_organization_id,'send_email',
    jsonb_build_object('lead_id',v_lead.id,'proposal_id',v_proposal.id,
      'subject',left(coalesce(p_subject,'Business proposal'),180),
      'text',left(coalesce(p_body,''),10000)),
    'queued',now(),0,4)
  returning id into v_job_id;
  update public.growth_proposals
    set delivery_status='queued',delivery_job_id=v_job_id,
        response_token_hash=p_response_token_hash,
        response_token_expires_at=p_response_token_expires_at,
        response_token_issued_at=now(),updated_at=now()
    where id=p_proposal_id and organization_id=p_organization_id;
  return query select v_job_id,'queued'::text;
end; $$;
revoke all on function public.growth_queue_proposal_email_with_response(uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.growth_queue_proposal_email_with_response(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

create or replace function public.growth_respond_to_proposal(p_token_hash text,p_decision text)
returns table(reference_no text,title text,status text,total_amount numeric,currency text,responded_at timestamptz)
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
  v_proposal public.growth_proposals%rowtype;
  v_next text;
  v_now timestamptz := now();
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid response token'; end if;
  if p_decision is null or p_decision not in ('accepted','rejected') then raise exception 'Decision must be accepted or rejected'; end if;
  select * into v_proposal from public.growth_proposals
   where response_token_hash=p_token_hash for update;
  if not found then raise exception 'Response link is invalid or has already been used'; end if;
  if v_proposal.response_token_expires_at is null or v_proposal.response_token_expires_at <= v_now then
    update public.growth_proposals set status='expired',response_token_hash=null,updated_at=v_now
      where id=v_proposal.id;
    return query select v_proposal.reference_no,v_proposal.title,'expired'::text,
      v_proposal.total_amount,v_proposal.currency,v_proposal.responded_at;
    return;
  end if;
  if v_proposal.status <> 'sent' then raise exception 'Only a sent proposal can be accepted or rejected'; end if;
  v_next := p_decision;
  update public.growth_proposals
    set status=v_next,responded_at=v_now,response_token_hash=null,updated_at=v_now
    where id=v_proposal.id;
  update public.growth_leads
    set status=case when v_next='accepted' then 'won' else 'lost' end,updated_at=v_now
    where id=v_proposal.lead_id and organization_id=v_proposal.organization_id
      and (v_next='accepted' or status <> 'won');
  insert into public.growth_lead_activities(organization_id,lead_id,activity_type,body,metadata)
  values(v_proposal.organization_id,v_proposal.lead_id,'note',
    'Customer '||case when v_next='accepted' then 'accepted' else 'rejected' end||
      ' proposal '||v_proposal.reference_no||'.',
    jsonb_build_object('proposal_id',v_proposal.id,'decision',v_next,'source','secure_customer_response_link'));
  return query select v_proposal.reference_no,v_proposal.title,v_next,
    v_proposal.total_amount,v_proposal.currency,v_now;
end; $$;
revoke all on function public.growth_respond_to_proposal(text,text) from public,anon,authenticated;
grant execute on function public.growth_respond_to_proposal(text,text) to service_role;
