-- Defence in depth: enforce unique response tokens and reject NULL RPC arguments.
create unique index if not exists growth_proposals_response_token_unique_idx
  on public.growth_proposals(response_token_hash) where response_token_hash is not null;
create or replace function public.growth_respond_to_proposal(p_token_hash text,p_decision text)
returns table(reference_no text,title text,status text,total_amount numeric,currency text,responded_at timestamptz)
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_proposal public.growth_proposals%rowtype; v_next text; v_now timestamptz := now();
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid response token'; end if;
  if p_decision is null or p_decision not in ('accepted','rejected') then raise exception 'Decision must be accepted or rejected'; end if;
  select * into v_proposal from public.growth_proposals where response_token_hash=p_token_hash for update;
  if not found then raise exception 'Response link is invalid or has already been used'; end if;
  if v_proposal.response_token_expires_at is null or v_proposal.response_token_expires_at <= v_now then
    update public.growth_proposals set status='expired',response_token_hash=null,updated_at=v_now where id=v_proposal.id;
    return query select v_proposal.reference_no,v_proposal.title,'expired'::text,v_proposal.total_amount,v_proposal.currency,v_proposal.responded_at;
    return;
  end if;
  if v_proposal.status <> 'sent' then raise exception 'Only a sent proposal can be accepted or rejected'; end if;
  v_next := p_decision;
  update public.growth_proposals set status=v_next,responded_at=v_now,response_token_hash=null,updated_at=v_now where id=v_proposal.id;
  update public.growth_leads set status=case when v_next='accepted' then 'won' else 'lost' end,updated_at=v_now
    where id=v_proposal.lead_id and organization_id=v_proposal.organization_id and (v_next='accepted' or status <> 'won');
  insert into public.growth_lead_activities(organization_id,lead_id,activity_type,body,metadata)
  values(v_proposal.organization_id,v_proposal.lead_id,'note','Customer '||case when v_next='accepted' then 'accepted' else 'rejected' end||' proposal '||v_proposal.reference_no||'.',jsonb_build_object('proposal_id',v_proposal.id,'decision',v_next,'source','secure_customer_response_link'));
  return query select v_proposal.reference_no,v_proposal.title,v_next,v_proposal.total_amount,v_proposal.currency,v_now;
end; $$;
revoke all on function public.growth_respond_to_proposal(text,text) from public,anon,authenticated;
grant execute on function public.growth_respond_to_proposal(text,text) to service_role;
